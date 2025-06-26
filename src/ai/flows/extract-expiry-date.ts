'use server';

/**
 * @fileOverview Extracts an expiry date from an image using GenAI.
 *
 * - extractExpiryDate - A function that extracts an expiry date from the given image.
 * - ExtractExpiryDateInput - The input type for the extractExpiryDate function.
 * - ExtractExpiryDateOutput - The return type for the extractExpiryDate function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractExpiryDateInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a product label, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractExpiryDateInput = z.infer<typeof ExtractExpiryDateInputSchema>;

const ExtractExpiryDateOutputSchema = z.object({
  expiryDate: z
    .string()
    .describe(
      'The standardized expiration date in ISO 8601 format (YYYY-MM-DD), or null if no date is found.'
    )
    .nullable(),
});
export type ExtractExpiryDateOutput = z.infer<typeof ExtractExpiryDateOutputSchema>;

export async function extractExpiryDate(input: ExtractExpiryDateInput): Promise<ExtractExpiryDateOutput> {
  return extractExpiryDateFlow(input);
}

const extractExpiryDatePrompt = ai.definePrompt({
  name: 'extractExpiryDatePrompt',
  input: {schema: ExtractExpiryDateInputSchema},
  output: {schema: ExtractExpiryDateOutputSchema},
  prompt: `You are an AI assistant designed to extract expiration dates from images of product labels.

  Your task is to analyze the provided image and identify ONLY the expiration date. Dates can be in various formats (e.g., dd/MM/yyyy, yyyy-MM-dd, MM/yyyy, etc.).

  If you find a valid expiration date, standardize it to ISO 8601 format (YYYY-MM-DD).
  If you cannot find an expiration date, return null for the expiryDate field.

  Image of product label: {{media url=photoDataUri}}
  `,
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
    ],
  },
});

const extractExpiryDateFlow = ai.defineFlow(
  {
    name: 'extractExpiryDateFlow',
    inputSchema: ExtractExpiryDateInputSchema,
    outputSchema: ExtractExpiryDateOutputSchema,
  },
  async input => {
    const {output} = await extractExpiryDatePrompt(input);
    return output || { expiryDate: null };
  }
);

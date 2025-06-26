import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

export const ai = genkit({
  plugins: [googleAI({ apiKey: "AIzaSyBbfTCTudy0rx8qxhgdg2un-BNQpaFdWP8" })],
  model: 'googleai/gemini-2.0-flash',
});

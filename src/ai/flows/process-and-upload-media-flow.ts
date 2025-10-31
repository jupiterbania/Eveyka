
'use server';
/**
 * @fileOverview A consolidated flow for processing and uploading media.
 * This flow handles file upload and dominant color extraction in a single server-side operation.
 *
 * - processAndUploadMedia - The main function for this flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { uploadMedia, type UploadMediaInput } from './upload-media-flow';

const ProcessMediaInputSchema = z.object({
  mediaDataUri: z.string(),
  mediaType: z.enum(['image', 'video']),
});

const ProcessMediaOutputSchema = z.object({
  mediaUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  dominantColor: z.string().optional(),
});

export type ProcessMediaInput = z.infer<typeof ProcessMediaInputSchema>;
export type ProcessMediaOutput = z.infer<typeof ProcessMediaOutputSchema>;


const ColorExtractInputSchema = z.object({
  photoDataUri: z.string(),
});

const ColorExtractOutputSchema = z.object({
  dominantColor: z.string().describe('The dominant color from the image in hex format (e.g., #RRGGBB).'),
});

const colorExtractPrompt = ai.definePrompt({
  name: 'colorExtractPromptInternal',
  input: { schema: ColorExtractInputSchema },
  output: { schema: ColorExtractOutputSchema },
  prompt: `Analyze the provided image and determine a single dominant color that would be suitable for a background. Return this color as a hex code. Image: {{media url=photoDataUri}}`,
});


export async function processAndUploadMedia(input: ProcessMediaInput): Promise<ProcessMediaOutput> {
    return processAndUploadMediaFlow(input);
}

const processAndUploadMediaFlow = ai.defineFlow(
  {
    name: 'processAndUploadMediaFlow',
    inputSchema: ProcessMediaInputSchema,
    outputSchema: ProcessMediaOutputSchema,
  },
  async (input) => {
    // Step 1: Upload the media
    const uploadInput: UploadMediaInput = {
        mediaDataUri: input.mediaDataUri,
        isVideo: input.mediaType === 'video',
    };
    const uploadResult = await uploadMedia(uploadInput);

    if (!uploadResult || !uploadResult.mediaUrl) {
      throw new Error('Media upload failed to return a URL.');
    }

    let dominantColor: string | undefined = undefined;

    // Step 2: If it's an image, extract the dominant color
    if (input.mediaType === 'image') {
      try {
        const colorResult = await colorExtractPrompt({ photoDataUri: input.mediaDataUri });
        dominantColor = colorResult.output?.dominantColor;
      } catch (colorError) {
        console.warn("Could not extract dominant color, will proceed without it.", colorError);
        // Do not re-throw; allow the upload to succeed without color info.
      }
    }

    // Step 3: Return the consolidated result
    return {
      mediaUrl: uploadResult.mediaUrl,
      thumbnailUrl: uploadResult.thumbnailUrl,
      dominantColor: dominantColor,
    };
  }
);


'use server';
/**
 * @fileOverview A flow for uploading media to an external service.
 *
 * - uploadMedia - A function that handles the media upload process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import ImageKit from 'imagekit';

const UploadMediaInputSchema = z.object({
  mediaDataUri: z
    .string()
    .describe(
      "Media to be uploaded, as a data URI that must include a MIME type and use Base64 encoding."
    ),
  isVideo: z.boolean().optional().describe("Flag to indicate if the media is a video."),
});
export type UploadMediaInput = z.infer<typeof UploadMediaInputSchema>;

const UploadMediaOutputSchema = z.object({
  mediaUrl: z.string().url().describe('The URL of the uploaded media.'),
  thumbnailUrl: z.string().url().optional().describe('The URL of the media thumbnail, if applicable.'),
});
export type UploadMediaOutput = z.infer<typeof UploadMediaOutputSchema>;


export async function uploadMedia(input: UploadMediaInput): Promise<UploadMediaOutput> {
  return uploadMediaFlow(input);
}

const uploadMediaFlow = ai.defineFlow(
  {
    name: 'uploadMediaFlow',
    inputSchema: UploadMediaInputSchema,
    outputSchema: UploadMediaOutputSchema,
  },
  async (input) => {
    const imagekit = new ImageKit({
      publicKey: 'public_3BzpFL5pqk2Qn42+6s7TAa0gFqc=',
      privateKey: 'private_gDgJMY3xa9l+pkjMH6r2OIg3UfA=',
      urlEndpoint: 'https://ik.imagekit.io/oco6vyb1z',
    });

    try {
      const uploadOptions: any = {
        file: input.mediaDataUri,
        fileName: `media-${Date.now()}`,
        useUniqueFileName: true,
      };

       if (input.isVideo) {
        // For videos, ask ImageKit to generate a thumbnail using the standard generator.
        uploadOptions.transformation = {
            pre: "media-thumbnail-generator"
        };
      }

      const response = await imagekit.upload(uploadOptions);

      if (!response.url) {
        console.error('ImageKit full response on failure:', JSON.stringify(response, null, 2));
        throw new Error('ImageKit response did not include a URL.');
      }
      
      return {
        mediaUrl: response.url,
        thumbnailUrl: response.thumbnailUrl,
      };

    } catch (error: any) {
        console.error('ImageKit upload failed:', error);
        // Re-throw a clean error with just the message for the client.
        throw new Error(error.message || 'An unknown error occurred during media upload.');
    }
  }
);

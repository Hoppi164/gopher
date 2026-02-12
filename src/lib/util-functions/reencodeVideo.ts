import { convertMedia } from '@remotion/webcodecs';

export async function reencodeVideo(blob: Blob): Promise<Blob> {
	const output = await convertMedia({
		src: blob,

		container: 'webm',
		videoCodec: 'vp9',
		audioCodec: 'opus'

		// container: 'mp4',
		// videoCodec: 'H.264',
		// audioCodec: 'AAC',
	});
	return output.save();
}

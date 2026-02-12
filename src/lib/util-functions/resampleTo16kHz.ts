import { convertMedia, canReencodeAudioTrack } from '@remotion/webcodecs';

export async function resampleAudio(blob: Blob, targetSampleRate: number = 16000): Promise<Blob> {
	const output = await convertMedia({
		src: blob,
		container: 'wav',
		onAudioTrack: async ({ track }) => {
			if (
				await canReencodeAudioTrack({
					audioCodec: 'wav',
					track,
					// Ignore this, bitrate is not used for WAV files
					bitrate: 128000,
					sampleRate: targetSampleRate
				})
			) {
				return {
					type: 'reencode',
					audioCodec: 'wav',
					bitrate: 128000,
					sampleRate: targetSampleRate
				};
			}

			// If this conversion is not supported, return an error
			return {
				type: 'fail'
			};
		}
	});

	const audioBlob = await output.save(); // returns a `Blob`
	return audioBlob;
}

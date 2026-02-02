<script lang="ts">
	import Microphone from '@tabler/icons-svelte-runes/icons/microphone';
	import MicrophoneFilled from '@tabler/icons-svelte-runes/icons/microphone-filled';
	import { resampleAudio } from '$lib/util-functions/resampleTo16kHz';
	import { downloadBlob } from '$lib/util-functions/downloadBlob';
	import { reencodeVideo } from '$lib/util-functions/reencodeVideo';

	let isRecording = $state(false);
	let captureStream: MediaStream | null = null;
	let mediaRecorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];

	async function toggleRecording() {
		isRecording = !isRecording;
		if (isRecording) {
			console.log('Starting recording...');
			await startRecording();
		} else {
			console.log('Stopping recording...');
			stopRecording();
		}
	}

	async function startRecording() {
		const displayMediaOptions = {
			video: {
				displaySurface: 'browser'
			},
			audio: true,
			preferCurrentTab: false
			// selfBrowserSurface: 'exclude',
			// systemAudio: 'include',
			// surfaceSwitching: 'include',
			// monitorTypeSurfaces: 'include'
		};

		const mimeTypes = [
			'video/webm;codecs=vp9,opus', // VP9 - best quality, but limited support
			'video/webm;codecs=vp8,opus', // VP8 - most compatible, no alpha issues
			'video/webm;codecs=h264,opus', // H.264 - good compatibility
			'video/webm', // Generic fallback
			'video/mp4' // MP4 fallback
		];

		let selectedMimeType = '';
		for (const mimeType of mimeTypes) {
			const isSupported = MediaRecorder.isTypeSupported(mimeType);
			if (isSupported && !selectedMimeType) {
				selectedMimeType = mimeType;
				break;
			}
		}

		const recorderOptions = {
			mimeType: selectedMimeType,
			videoBitsPerSecond: 500000,
			audioBitsPerSecond: 128000, // 128 kbps for audio with video
			width: 640, // Reduce resolution
			height: 480
		};
		const timeslice = 5000;

		try {
			captureStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

			// Verify stream tracks before creating MediaRecorder
			const videoTracks = captureStream.getVideoTracks();
			const audioTracks = captureStream.getAudioTracks();

			mediaRecorder = new MediaRecorder(captureStream, recorderOptions);

			mediaRecorder.ondataavailable = (event) => {
				console.log(event.data);
				chunks.push(event.data);
			};

			mediaRecorder.start(timeslice);
			isRecording = true;
		} catch (err) {
			console.error(`Error: ${err}`);
		}
		return captureStream;
	}

	async function stopRecording() {
		if (mediaRecorder && mediaRecorder.state !== 'inactive') {
			mediaRecorder.stop();
			isRecording = false;
			console.log('Recording stopped.');
		}
		if (captureStream) {
			captureStream.getTracks().forEach((track) => track.stop());
			captureStream = null;
			console.log('Capture stream stopped.');
		}

		// Sleep for 1 secs to ensure data stream is finalized
		await new Promise((resolve) => setTimeout(resolve, 1000));

		let blob = new Blob(chunks, { type: 'video/webm' });

		// Convert to mp4 for better compatibility
		// Download Video
		const videoblob = await reencodeVideo(blob);
		downloadBlob(videoblob, 'recording.webm');


		// Resample audio to 16kHz for ASR
		// Download audio
		const audioBlob = await resampleAudio(blob, 16000);
		downloadBlob(audioBlob, 'audio.wav');
	}
</script>

<article>
	<h1 class="text-center">Gopher Recorder</h1>
	<div class="flex-center">
		<button
			onclick={toggleRecording}
			aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
		>
			{#if isRecording}
				<MicrophoneFilled />
				Stop Recording
			{:else}
				<Microphone />
				Start Recording
			{/if}
		</button>
	</div>
</article>

<style>
</style>

import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('home page has expected h1', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toBeVisible();
});

test('recording workflow with mocked media streams', async ({ page, context }) => {
	// Navigate to the page
	await page.goto('/');

	// Verify page loaded correctly
	await expect(page.locator('h1')).toContainText('Gopher Recorder');

	// Load test files
	const testVideoPath = path.join(process.cwd(), 'tests', 'test-recording-meeting.webm');
	const testAudioPath = path.join(process.cwd(), 'tests', 'test-audio-meeting.wav');
	
	// Read the test files
	const testVideoBuffer = fs.readFileSync(testVideoPath);
	const testAudioBuffer = fs.readFileSync(testAudioPath);

	// Set up download tracking BEFORE any interactions
	const downloads: any[] = [];
	page.on('download', async (download) => {
		const filename = download.suggestedFilename();
		console.log('Download detected:', filename);
		downloads.push({
			filename: filename,
			download: download
		});
	});

	// Mock the getDisplayMedia API and MediaRecorder
	await page.evaluate(({ videoData, audioData }) => {
		// Create blobs from the test data
		const videoBlob = new Blob([new Uint8Array(videoData)], { type: 'video/webm' });
		const audioBlob = new Blob([new Uint8Array(audioData)], { type: 'audio/wav' });

		// Mock MediaStream with tracks
		class MockMediaStreamTrack {
			kind: string;
			enabled: boolean = true;
			constructor(kind: string) {
				this.kind = kind;
			}
			stop() {
				this.enabled = false;
			}
		}

		class MockMediaStream {
			tracks: MockMediaStreamTrack[];
			constructor() {
				this.tracks = [
					new MockMediaStreamTrack('video'),
					new MockMediaStreamTrack('audio')
				];
			}
			getVideoTracks() {
				return this.tracks.filter((t: MockMediaStreamTrack) => t.kind === 'video');
			}
			getAudioTracks() {
				return this.tracks.filter((t: MockMediaStreamTrack) => t.kind === 'audio');
			}
			getTracks() {
				return this.tracks;
			}
		}

		// Mock MediaRecorder
		class MockMediaRecorder {
			stream: any;
			options: any;
			state: string = 'inactive';
			ondataavailable: ((event: any) => void) | null = null;
			
			constructor(stream: any, options: any) {
				this.stream = stream;
				this.options = options;
			}

			start(timeslice?: number) {
				this.state = 'recording';
				console.log('MockMediaRecorder started');
				// Simulate data available after a short delay
				setTimeout(() => {
					console.log('MockMediaRecorder emitting data');
					if (this.ondataavailable) {
						this.ondataavailable({ data: videoBlob });
					}
				}, 100);
			}

			stop() {
				this.state = 'inactive';
				console.log('MockMediaRecorder stopped');
			}

			static isTypeSupported(mimeType: string) {
				return mimeType.includes('video/webm');
			}
		}

		// Override the navigator methods
		Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
			writable: true,
			value: async () => {
				console.log('Mock getDisplayMedia called');
				return new MockMediaStream();
			}
		});

		// @ts-ignore
		window.MediaRecorder = MockMediaRecorder;
		
		console.log('Mocks initialized');
	}, { videoData: Array.from(testVideoBuffer), audioData: Array.from(testAudioBuffer) });

	// Find and click the "Start Recording" button
	const recordButton = page.getByRole('button', { name: /Start Recording/i });
	await expect(recordButton).toBeVisible();
	
	console.log('Clicking start recording button');
	await recordButton.click();

	// Button should now show "Stop Recording"
	await expect(page.getByRole('button', { name: /Stop Recording/i })).toBeVisible();
	console.log('Recording started, button changed to Stop Recording');

	// Wait a bit for recording to happen (simulating actual recording time)
	await page.waitForTimeout(2000);

	// Click stop recording
	const stopButton = page.getByRole('button', { name: /Stop Recording/i });
	console.log('Clicking stop recording button');
	await stopButton.click();

	// Button should return to "Start Recording"
	await expect(recordButton).toBeVisible();
	console.log('Recording stopped, button changed back to Start Recording');

	// Wait for downloads to complete (processing might take a moment)
	// The app uses sleep(1000) plus processing time
	await page.waitForTimeout(5000);

	console.log('Total downloads detected:', downloads.length);
	downloads.forEach(d => console.log('  -', d.filename));

	// Verify downloads were triggered
	expect(downloads.length).toBeGreaterThanOrEqual(2);

	// Check for recording file
	const recordingDownload = downloads.find(d => d.filename.includes('recording'));
	expect(recordingDownload).toBeDefined();
	expect(recordingDownload?.filename).toBe('recording.webm');

	// Check for audio file
	const audioDownload = downloads.find(d => d.filename.includes('audio'));
	expect(audioDownload).toBeDefined();
	expect(audioDownload?.filename).toBe('audio.wav');

	console.log('✓ Recording workflow test passed');
	console.log('✓ Video download confirmed:', recordingDownload?.filename);
	console.log('✓ Audio download confirmed:', audioDownload?.filename);
});

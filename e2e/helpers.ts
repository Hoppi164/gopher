import { expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface TestFiles {
	videoData: number[];
	audioData: number[];
}

export interface DownloadTracker {
	downloads: Array<{ filename: string; download: any }>;
}

/**
 * Load test media files from the tests directory
 */
export function loadTestFiles(): TestFiles {
	const testVideoPath = path.join(process.cwd(), 'tests', 'test-recording-meeting.webm');
	const testAudioPath = path.join(process.cwd(), 'tests', 'test-audio-meeting.wav');

	const testVideoBuffer = fs.readFileSync(testVideoPath);
	const testAudioBuffer = fs.readFileSync(testAudioPath);

	return {
		videoData: Array.from(testVideoBuffer),
		audioData: Array.from(testAudioBuffer)
	};
}

/**
 * Set up download tracking for the page
 */
export function setupDownloadTracking(page: Page, verbose = false): DownloadTracker {
	const tracker: DownloadTracker = { downloads: [] };

	page.on('download', async (download) => {
		const filename = download.suggestedFilename();
		if (verbose) {
			console.log('Download detected:', filename);
		}
		tracker.downloads.push({ filename, download });
	});

	return tracker;
}

/**
 * Set up console message capturing from the page
 */
export function setupConsoleCapture(page: Page, verbose = false): string[] {
	const messages: string[] = [];

	page.on('console', (msg) => {
		const text = msg.text();
		messages.push(text);
		if (verbose) {
			console.log('Browser console:', text);
		}
	});

	return messages;
}

/**
 * Mock the MediaRecorder and getDisplayMedia APIs for testing
 */
export async function mockMediaAPIs(page: Page, testFiles: TestFiles): Promise<void> {
	await page.evaluate(({ videoData, audioData }) => {
		const videoBlob = new Blob([new Uint8Array(videoData)], { type: 'video/webm' });

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
				this.tracks = [new MockMediaStreamTrack('video'), new MockMediaStreamTrack('audio')];
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
				setTimeout(() => {
					if (this.ondataavailable) {
						this.ondataavailable({ data: videoBlob });
					}
				}, 100);
			}

			stop() {
				this.state = 'inactive';
			}

			static isTypeSupported(mimeType: string) {
				return mimeType.includes('video/webm');
			}
		}

		Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {
			writable: true,
			value: async () => new MockMediaStream()
		});

		// @ts-ignore
		window.MediaRecorder = MockMediaRecorder;
	}, testFiles);
}

/**
 * Perform a complete recording workflow: start, wait, stop
 */
export async function performRecordingWorkflow(
	page: Page,
	recordingDurationMs = 2000
): Promise<void> {
	const recordButton = page.getByRole('button', { name: /Start Recording/i });
	await expect(recordButton).toBeVisible();
	await recordButton.click();

	await expect(page.getByRole('button', { name: /Stop Recording/i })).toBeVisible();
	await page.waitForTimeout(recordingDurationMs);

	const stopButton = page.getByRole('button', { name: /Stop Recording/i });
	await stopButton.click();
	await expect(recordButton).toBeVisible();
}

/**
 * Verify that both recording and audio downloads were triggered
 */
export function verifyDownloads(tracker: DownloadTracker): void {
	expect(tracker.downloads.length).toBeGreaterThanOrEqual(2);

	const recordingDownload = tracker.downloads.find((d) => d.filename.includes('recording'));
	expect(recordingDownload).toBeDefined();
	expect(recordingDownload?.filename).toBe('recording.webm');

	const audioDownload = tracker.downloads.find((d) => d.filename.includes('audio'));
	expect(audioDownload).toBeDefined();
	expect(audioDownload?.filename).toBe('audio.wav');
}

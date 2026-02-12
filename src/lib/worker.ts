console.log('Worker script loaded.');
self.addEventListener('message', (event: MessageEvent) => {
	console.log('Worker received message:', event.data);
	const blob = event.data as Blob;

	// Return "hello world"
	self.postMessage('hello world');
});
console.log('Worker script execution finished.');

import http from 'node:http';
import compression from 'compression';
import { handler } from './build/handler.js';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const compress = compression();

http
	.createServer((req, res) => {
		compress(req, res, () => {
			handler(req, res, () => {});
		});
	})
	.listen(PORT, HOST, () => {
		console.log(`Raillingo server in ascolto su http://${HOST}:${PORT}`);
	});

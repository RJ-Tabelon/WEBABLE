import { createServer } from 'node:http';

createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(
    '<!doctype html><html lang="en"><head><title>WebAble fixture</title></head><body><main><h1>Fixture page</h1></main></body></html>',
  );
}).listen(4173, '127.0.0.1');

const HyperExpress = require('hyper-express');
const LiveDirectory = require('live-directory');
const { Configuration: OpenAIConfig, OpenAIApi } = require("openai");
const basePrompt = require('./prompt.json');

const app = new HyperExpress.Server();

const isDevelopment = process.env.NODE_ENV != 'production';

const openaiChatModel = 'gpt-3.5-turbo';
const openai = new OpenAIApi(new OpenAIConfig({
  apiKey: process.env.OPENAI_KEY
}));

const streamEndToken = '[DONE]';

// static files middleware
const static = new LiveDirectory(__dirname + '/static', {
  static: false, // set this to true in prod
  filter: {
    ignore: {
      extensions: ['env'],
    },
  },
});

// serve static files
app.get('/*', (req, res) => {
  const path = req.path == '/' ? '/index.html' : req.path;
  const file = static.get(path);

  // return a 404 if no asset/file exists on the derived path
  if (!file) return res.status(404).send();

  if (file.cached) {
    res.send(file.content);
  } else {
    file.stream().pipe(res);
  }
});

// ChatGPT endpoint
app.ws('/chat', {
  idle_timeout: 60,
  max_payload_length: 32 * 1024
}, async (ws) => {
  let authed = false;
  let messages = basePrompt;

  ws.on('message', async data => {
    if (!authed) {
      authed = data == process.env.REQ_SECRET;
      return;
    }

    if (isDevelopment) {
      ws.atomic(() => {
        ws.send('Hello, demo response message! (Streaming)');
        ws.send(streamEndToken);
      });
      return;
    }

    messages.push({
      role: 'user',
      content: data
    });

    try {
      const chatCompletion = await openai.createChatCompletion({
        model: openaiChatModel,
        messages,
        stream: true
      }, {
        responseType: 'stream'
      });

      messages.push({
        role: 'assistant',
        content: ''
      });

      chatCompletion.data.on('data', (raw) => {
        const chunks = raw.toString().split('\n\n').map(s => s.replace(/^data: /, ''));

        let finalChunk = '';
        let didEnd = false;

        for (const chunk of chunks) {
          if (!chunk) {
            continue;
          }

          if (chunk == streamEndToken) {
            didEnd = true;
            break;
          }

          let data = null;
          try {
            data = JSON.parse(chunk);
          } catch (err) {
            console.error('Error parsing chunk:', err, 'Chunk is', JSON.stringify(chunk));
            return;
          }

          const chunkContent = data.choices[0]?.delta?.content;

          if (!chunkContent) {
            continue;
          }

          finalChunk += chunkContent;
        }

        messages[messages.length - 1].content += finalChunk;

        ws.send(finalChunk);

        if (didEnd) {
          ws.send(streamEndToken);
        }
      });

      chatCompletion.data.on('end', () => {
        ws.send(streamEndToken);
      });
    } catch (err) {
      console.error('Error in chatCompletion:', err);
    }
  });
});

app.listen(3000);

if (isDevelopment) {
  console.warn('In development mode!');
}
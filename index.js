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

// message roles allowed from the client
const allowedClientRoles = ['user', 'assistant'];

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
app.post('/chat', async (req, res) => {
  const { secret, messages } = await req.json();

  if (!(messages instanceof Array)) {
    return res.atomic(() => {
      res
        .status(400)
        .send('Messages must be an array (of objects).');
    });
  }

  if (secret != process.env.REQ_SECRET) {
    return res.atomic(() => {
      res
        .status(401)
        .send('Invalid or no secret provided.\n');
    });
  }

  let messagesCheckError = null;
  for (const message of messages) {
    if (typeof message.role != 'string') {
      messagesCheckError = 'Role must be a string.';
      break;
    }

    if (typeof message.content != 'string') {
      messagesCheckError = 'Content must be a string.';
      break;
    }

    if (!allowedClientRoles.includes(message.role)) {
      messagesCheckError = 'Role is not allowed.';
      break;
    }
  }

  if (messagesCheckError) {
    return res.atomic(() => {
      res
        .status(400)
        .send(messagesCheckError);
    });
  }

  let data = null;

  if (isDevelopment) {
    data = {
      message: {
        role: 'assistant',
        content: 'Hello, demo response message!'
      }
    };
  } else {
    const chatCompletion = await openai.createChatCompletion({
      model: openaiChatModel,
      messages: [
        ...basePrompt,
        ...messages
      ]
    });

    data = chatCompletion.data.choices[0];
  }

  res.json(data);
});

app.listen(3000);

if (isDevelopment) {
  console.warn('In development mode!');
}
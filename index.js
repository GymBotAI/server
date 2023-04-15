const HyperExpress = require('hyper-express');
const LiveDirectory = require('live-directory');

const app = new HyperExpress.Server();

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

app.listen(3000);

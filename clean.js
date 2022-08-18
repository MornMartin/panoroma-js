const rm = require('rimraf');
const path = require('path');
rm(path.resolve('dist/*'), (err) => {
    if (err) throw err;
});

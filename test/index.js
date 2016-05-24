import test from 'ava';
import 'babel-core/register';

import socketIoIotServer from '../src/lib/';

test('socketIoIotServer', (t) => {
  t.is(socketIoIotServer(), true);
});

# Smart Json Patch Application (RFC6902)

This module will "smartly" apply json patches to a document.

It will leave leaf nodes intact, e.g.:

```js
import { applyPatch } from 'smart-json-patch'

const oldDoc = { items: [], payments: [] }
const patch = [{ op: 'add', path: '/items/-', value: { id: '1' } }]

const newDoc = applyPatch(oldDoc, patch)
assert.deepStrictEqual(newDoc, { items: [{ id: '1' }], payments: [] })
assert.ok(oldDoc !== newDoc)
assert.ok(oldDoc.items !== newDoc.items)
assert.ok(oldDoc.payments === newDoc.payments) // didn't change, will be same object
```

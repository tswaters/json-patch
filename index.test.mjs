import v8 from 'v8'
import { throws, deepStrictEqual, ok } from 'assert'
import fastJsonPatch from 'fast-json-patch'
import { applyPatch } from './index.mjs'

import specTests from './test-fixtures/spec-tests.json'
import tests from './test-fixtures/tests.json'

const { compare } = fastJsonPatch

const structuredClone = (o) => v8.deserialize(v8.serialize(o))

describe('fixture tests', () => {
  for (const test of [...tests, ...specTests]) {
    const spec = test.disabled ? it.skip : test.only ? it.only : it
    spec(test.comment, () =>
      test.error
        ? throws(
            () => applyPatch(test.doc, test.patch),
            (err) => err.message.includes(test.error) || err.code === test.error
          )
        : deepStrictEqual(applyPatch(test.doc, test.patch), test.expected)
    )
  }
})

describe('prototype pollution', () => {
  it('shouldnt pollute when `path` includes prototype', () => {
    throws(
      () =>
        applyPatch({}, [
          { op: 'add', path: '/prototype/x', value: 'polluted' },
        ]),
      (err) => err.message.includes('banned')
    )
  })
  it('shouldnt pollute when `from` includes prototype', () => {
    throws(
      () =>
        applyPatch({}, [{ op: 'copy', from: '/prototype/toString', to: '/' }]),
      (err) => err.message.includes('banned')
    )
  })
  it('shouldnt pollute when `path` includes constructor', () => {
    throws(
      () =>
        applyPatch({}, [
          { op: 'add', path: '/constructor/x', value: 'polluted' },
        ]),
      (err) => err.message.includes('banned')
    )
  })
  it('shouldnt pollute when `from` includes constructor', () => {
    throws(
      () =>
        applyPatch({}, [
          { op: 'copy', from: '/constructor/toString', to: '/' },
        ]),
      (err) => err.message.includes('banned')
    )
  })
  it('shouldnt pollute when `path` includes __proto__', () => {
    throws(
      () =>
        applyPatch({}, [
          { op: 'add', path: '/__proto__/x', value: 'polluted' },
        ]),
      (err) => err.message.includes('banned')
    )
  })
  it('shouldnt pollute when `from` includes __proto__', () => {
    throws(
      () =>
        applyPatch({}, [{ op: 'copy', from: '/__proto__/toString', to: '/' }]),
      (err) => err.message.includes('banned')
    )
  })
})

describe('selective clones', () => {
  const obj = {
    id: '123',
    items: [{ id: '234', quantity: 0 }],
    payments: [],
  }

  const newObj = {
    id: '123',
    items: [
      { id: '234', quantity: 0 },
      { id: '234', quantity: 1 },
    ],
    payments: [],
  }

  let operations
  let oldObj

  beforeEach(() => {
    operations = compare(obj, newObj)
    oldObj = structuredClone(obj)
  })

  it('has a test', () => {
    const applied = applyPatch(oldObj, operations)
    deepStrictEqual(applied, newObj) // should be same
    ok(applied !== oldObj)
    ok(applied.items[0] === oldObj.items[0])
    ok(applied.payments === oldObj.payments)
  })
})

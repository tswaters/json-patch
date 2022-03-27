import assert from 'assert'

const escapeComponent = (component) =>
  component.replace('~1', '/').replace('~0', '~')

const operations = ['move', 'copy', 'add', 'replace', 'remove', 'test']

export const applyPatch = (doc, ops) => {
  if (!Array.isArray(ops) || ops.length === 0) return doc

  const newObj = Array.isArray(doc) ? [...doc] : { ...doc }

  return ops.reduce((newObj, item) => {
    if (!operations.includes(item.op)) {
      throw new Error(
        `Unexpeced operation: ${item.op} expected (${operations.join(',')})`
      )
    }

    let target
    if (item.op === 'move' || item.op === 'copy') {
      target = item.from
        .substr(1)
        .split('/')
        .map(escapeComponent)
        .reduce((acc, component, idx, arr) => {
          let ref = acc[component]
          if (ref == null) throw new Error(`path ${item.from} does not exist`)
          if (idx < arr.length - 1) return ref
          switch (item.op) {
            case 'move':
              if (Array.isArray(acc)) acc.splice(component, 1)
              else delete acc[component] // dirty dirty.
              return ref
            case 'copy':
              return { ...acc[component] }
          }
        }, newObj)
    }

    let inArray = Array.isArray(newObj)
    let pointer = newObj
    const components = item.path.substr(1).split('/')

    // getting an empty path means operation is applied to entire document
    if (item.path === '') {
      if (item.op === 'test') assert.deepStrictEqual(newObj, item.value)
      if (['replace', 'add', 'test'].includes(item.op)) return item.value
      if (['move', 'copy'].includes(item.op)) return target
    }

    for (let i = 0; i < components.length; i += 1) {
      const component = escapeComponent(components[i])

      // don't mutate on test.
      if (item.op !== 'test') {
        if (Array.isArray(pointer[component])) {
          pointer[component] = [...pointer[component]]
        } else if (
          !['string', 'number'].includes(typeof pointer[component]) &&
          pointer[component] != null
        ) {
          pointer[component] = { ...pointer[component] }
        }
      }

      // this is the last ieration of the components, where changes are applied
      // else conditions either move `pointer` to the next component, or throw error

      if (i === components.length - 1) {
        if (
          inArray &&
          component !== '-' &&
          parseInt(component, 10) !== pointer.length &&
          // todo: this isn't correct, allows 1e0 to match '1'
          // i.e.,  a['1e0'] === a['1'] ; it's expected this doesn't match
          pointer[component] == null
        ) {
          throw new Error(`path ${item.path} does not exist`)
        }

        switch (item.op) {
          case 'add':
            if (inArray && component === '-') pointer.push(item.value)
            else if (inArray) pointer.splice(component, 0, item.value)
            else pointer[component] = item.value
            break
          case 'replace':
            if (inArray) pointer.splice(component, 1, item.value)
            else pointer[component] = item.value
            break
          case 'remove':
            if (inArray) pointer.splice(component, 1)
            else delete pointer[component] // dirty, dirty.
            break
          case 'test':
            // todo: deepStrictEqual not the same as rfc6902
            assert.deepStrictEqual(pointer[component], item.value)
            break
          case 'move':
          case 'copy':
            pointer[component] = target
            break
        }
      } else if (pointer[component] == null) {
        throw new Error(`path ${item.path} does not exist`)
      } else {
        inArray = Array.isArray(pointer[component])
        pointer = pointer[component]
      }
    }

    return newObj
  }, newObj)
}

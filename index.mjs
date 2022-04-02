import assert from 'assert'


const escapeComponent = (component) => {
  const escaped = component.replace('~1', '/').replace('~0', '~')
  if (['__proto__', 'constructor', 'prototype'].includes(escaped)) {
    throw new Error(`can't mutate ${component} it is banned`)
  }
  return escaped
}

const operations = ['move', 'copy', 'add', 'replace', 'remove', 'test']

export const applyPatch = (doc, ops) => {
  if (!Array.isArray(ops) || ops.length === 0) return doc

  const newObj = Array.isArray(doc) ? [...doc] : { ...doc }

  return ops.reduce((newObj, item) => {
    if (!operations.includes(item.op)) return

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

    const components = item.path.substr(1).split('/')

    // getting an empty path means operation is applied to entire document
    if (item.path === '') {
      if (item.op === 'test') assert.deepStrictEqual(newObj, item.value)
      if (['replace', 'add', 'test'].includes(item.op)) return item.value
      if (['move', 'copy'].includes(item.op)) return target
    }

    let i = 0
    let inArray
    let pointer
    let component

    do {
      inArray = Array.isArray(!component ? newObj : pointer[component])
      pointer = !component ? newObj : pointer[component]
      component = escapeComponent(components[i])
      if (item.op === 'test') continue

      if (Array.isArray(pointer[component])) {
        pointer[component] = [...pointer[component]]
      } else if (
        typeof pointer[component] === 'object' &&
        pointer[component] != null
      ) {
        pointer[component] = { ...pointer[component] }
      }
    } while (
      ++i < components.length &&
      typeof pointer[component] !== 'undefined'
    )

    if (
      // exited out before finding an object (TypeError likely)
      (i < components.length && typeof pointer[component] === 'undefined') ||
      // exited out, can't find target, but using add/move/copy so it's OK.
      (i === components.length &&
        !['add', 'move', 'copy'].includes(item.op) &&
        typeof pointer[component] === 'undefined') ||
      // trying to push to something that isn't an array
      //  "-" is a special case meaning "the last element"
      // otherwise try to ensure we have an index-looking thing in the path
      // this could be, e.g., '1e3' - and that should be an error because only a "number" should push to array
      // js of course is loose with this "number" and it's ok parsing a string of scientific notation as number
      // only accept [0-9]{1,} for inputs here
      (Array.isArray(pointer) && component !== '-' && /[^0-9]/.test(component))
    ) {
      throw new Error(`path ${item.path} does not exist`)
    }

    if (i === components.length) {
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
    }

    return newObj
  }, newObj)
}

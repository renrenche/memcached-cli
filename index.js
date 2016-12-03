const co = require('co')
const memjs = require('memjs')
const vorpal = require('vorpal')()

const client = memjs.Client.create()

const METHOD_DESCRIPTION = {
  get: 'get',
  set: 'set',
  add: 'add',
  replace: 'repalce',
  delete: 'delete',
  increment: 'increment',
  decrement: 'decrement',
  flush: 'flush',
  stats: 'stats',
}

// Get all methods name
const METHODS = Object.keys(METHOD_DESCRIPTION)

function getCommand(method) {
  switch (method) {
    // No argument
    case 'flush':
    case 'stats':
      return {
        command: method,
        query: () => cb => client[method](cb),
      }

    // One argument, key
    case 'get':
    case 'delete':
      return {
        command: `${method} <key>`,
        query: args => cb => client[method](args.key, cb),
      }

    // key, value, expires(optional)
    case 'set':
    case 'add':
    case 'replace':
      return {
        command: `${method} <key> <value> [expires]`,
        query: args => cb => client[method](args.key, args.value, cb, args.expires),
      }

    // key, amount, expires(optional)
    case 'increment':
    case 'decrement':
      return {
        command: `${method} <key> <amount> [expires]`,
        query: args => cb => client[method](args.key, args.value, cb, args.expires),
      }
    default:
      throw new Error(`\`${method}\` is not supported`)
  }
}

// How to parse
function getParse(method) {
  switch (method) {
    case 'get':
      return (arr) => {
        const value = arr[0]
        const extra = arr[1]

        if (value === null) {
          return null
        }

        return [
          `value: ${value.toString()}`,
          `extra: ${extra.toString()}`,
        ].join('\n')
      }
    case 'stats':
      return (arr) => {
        const server = arr[0]
        const result = arr[1]

        // Make STATS result more readable
        const data = Object.keys(result).reduce((res, key) => {
          res.push(`${key} ${arr[1][key]}`)
          return res
        }, [])

        // Add server info
        data.unshift(`server ${server}`)
        return data.join('\n')
      }

    default:
      return arg => arg
  }
}

function makePromise(fn) {
  return co(function* wrap() {
    return yield fn
  })
}

// Register all methods to vorpal
METHODS.forEach((method) => {
  const opt = getCommand(method)
  const description = METHOD_DESCRIPTION[method]
  const parse = getParse(method)

  vorpal
    .command(opt.command)
    .description(description)
    .action(function action(args) {
      return makePromise(opt.query(args))
        .then(data => this.log(parse(data)))
        .catch(err => this.log(err))
    })
})

vorpal.delimiter('memcached >').show()

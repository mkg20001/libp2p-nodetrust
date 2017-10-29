const server = require("./")
const config = require(process.argv[2])
const Id = require("peer-id")
Id.createFromJSON(config.id, (err, id) => {
  if (err) return cb(err)
  config.id = id
  const s = new server(config)
  s.start(err => {
    if (err) throw err
    console.log("READY")
  })
})

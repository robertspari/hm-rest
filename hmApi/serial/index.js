const SerialPort = require('serialport')
const validateChecksum = require('./validateChecksum')
const {CSV_RECORD_REGEX} = require('./constants')

const SERIAL_BAUD = 38400
const SERIAL_INTERFACE = '/dev/serial0'

function Serial () {
	let port = new SerialPort(SERIAL_INTERFACE, {baudRate: SERIAL_BAUD})

	let handlers = []

	this.subscribe = (fn) => handlers.push(fn)

	this.unsubscribe = (fn) => handlers = handlers.filter(it => it !== fn)

	this.write = (message) => port.write(message, function (err) {
		if (err)
			throw err
	})

	let combinedData = ''

	port.on('readable', () => {

		// lines might be split so append whatever is coming to the total ignoring newlines
		combinedData += port.read().toString('utf8').replace('\n', '')

		// regex matches for a complete CSV record
		// complete means starting with $ and ending with an asterisk + a two digit hex checksum
		let match = CSV_RECORD_REGEX.exec(combinedData)

		while (match) {
			// additional validation to ensure checksum is correct
			if (validateChecksum(match[0]))
				handlers.forEach(handler => handler(match[0]))
			// todo: error events might be interesting for subscribers?

			// trim the current record
			combinedData = combinedData.substring(match[0].length + match.index)

			// retry in unlikely case that there are two records between values received
			match = CSV_RECORD_REGEX.exec(combinedData)
		}
	})
}

// Singleton to prevent issues with multiple open streams
module.exports = (() => {
	let instance

	const createInstance = () => new Serial()

	return {
		getInstance: () => {
			if (!instance) {
				instance = createInstance()
			}
			return instance
		}
	}
})()
/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const Block = require('ipfs-block')
const mh = require('multihashes')
const pull = require('pull-stream')
const parallel = require('run-parallel')
const _ = require('lodash')

module.exports = (repo) => {
  describe('blockstore', () => {
    const helloKey = 'CIQLS/CIQLSTJHXGJU2PQIUUXFFV62PWV7VREE57RXUU4A52IIR55M4LX432I.data'
    const helloIpldKey = 'CIQO2/CIQO2EUTF47PSTAHSL54KUTDS2AAN2DH4URM7H5KRATUGQFCM4OUIQI.ipld'
    const blockCollection = _.range(100).map((i) => new Block(new Buffer(`hello-${i}-${Math.random()}`)))

    describe('.putStream', () => {
      it('simple', (done) => {
        const b = new Block('hello world')
        pull(
          pull.values([b]),
          repo.blockstore.putStream(),
          pull.collect((err, meta) => {
            expect(err).to.not.exist
            expect(meta[0].key).to.be.eql(helloKey)
            done()
          })
        )
      })

      it('multi write (locks)', (done) => {
        const b = new Block('hello world')

        let i = 0
        const finish = (err, meta) => {
          expect(err).to.not.exist
          expect(meta[0].key).to.equal(helloKey)

          i++
          if (i === 2) done()
        }

        pull(
          pull.values([b]),
          repo.blockstore.putStream(),
          pull.collect(finish)
        )

        pull(
          pull.values([b]),
          repo.blockstore.putStream(),
          pull.collect(finish)
        )
      })

      it('massive multiwrite', (done) => {
        parallel(_.range(50).map(() => (cb) => {
          pull(
            pull.values(blockCollection),
            repo.blockstore.putStream(),
            pull.collect((err, meta) => {
              expect(err).to.not.exist
              expect(meta).to.have.length(100)
              cb()
            })
          )
        }), done)
      })

      it('custom extension', function (done) {
        const b = new Block('hello world 2', 'ipld')
        pull(
          pull.values([b]),
          repo.blockstore.putStream(),
          pull.collect((err, meta) => {
            expect(err).to.not.exist
            expect(meta[0].key).to.be.eql(helloIpldKey)
            done()
          })
        )
      })

      it('returns an error on invalid block', (done) => {
        pull(
          pull.values(['hello']),
          repo.blockstore.putStream(),
          pull.onEnd((err) => {
            expect(err.message).to.be.eql('Invalid block')
            done()
          })
        )
      })
    })

    describe('.getStream', () => {
      it('simple', (done) => {
        const b = new Block('hello world')

        pull(
          repo.blockstore.getStream(b.key),
          pull.collect((err, data) => {
            expect(err).to.not.exist
            expect(data[0]).to.be.eql(b)

            done()
          })
        )
      })

      it('massive read', (done) => {
        parallel(_.range(20 * 100).map((i) => (cb) => {
          const j = i % 20
          pull(
            repo.blockstore.getStream(blockCollection[j].key),
            pull.collect((err, meta) => {
              expect(err).to.not.exist
              expect(meta).to.be.eql([blockCollection[j]])
              cb()
            })
          )
        }), done)
      })

      it('custom extension', (done) => {
        const b = new Block('hello world 2', 'ipld')

        pull(
          repo.blockstore.getStream(b.key, b.extension),
          pull.collect((err, data) => {
            expect(err).to.not.exist
            expect(data[0]).to.be.eql(b)

            done()
          })
        )
      })

      it('returns an error on invalid block', (done) => {
        pull(
          repo.blockstore.getStream(),
          pull.onEnd((err) => {
            expect(err.message).to.be.eql('Invalid key')
            done()
          })
        )
      })
    })

    describe('.has', () => {
      it('existing block', (done) => {
        const b = new Block('hello world')

        repo.blockstore.has(b.key, (err, exists) => {
          expect(err).to.not.exist
          expect(exists).to.equal(true)
          done()
        })
      })

      it('with extension', (done) => {
        const b = new Block('hello world')

        repo.blockstore.has(b.key, 'data', (err, exists) => {
          expect(err).to.not.exist
          expect(exists).to.equal(true)
          done()
        })
      })

      it('non existent block', (done) => {
        const b = new Block('wooot')

        repo.blockstore.has(b.key, (err, exists) => {
          expect(err).to.not.exist
          expect(exists).to.equal(false)
          done()
        })
      })
    })

    describe('.delete', () => {
      it('simple', (done) => {
        const b = new Block('hello world')

        repo.blockstore.delete(b.key, (err) => {
          expect(err).to.not.exist

          repo.blockstore.has(b.key, (err, exists) => {
            expect(err).to.not.exist
            expect(exists).to.equal(false)
            done()
          })
        })
      })

      it('custom extension', (done) => {
        const b = new Block('hello world', 'ipld')

        repo.blockstore.delete(b.key, b.extension, (err) => {
          expect(err).to.not.exist

          repo.blockstore.has(b.key, b.extension, (err, exists) => {
            expect(err).to.not.exist
            expect(exists).to.equal(false)
            done()
          })
        })
      })
    })

    describe('interop', () => {
      it('reads welcome-to-ipfs', (done) => {
        const welcomeHash = mh.fromHexString(
          '1220120f6af601d46e10b2d2e11ed71c55d25f3042c22501e41d1246e7a1e9d3d8ec'
        )
        pull(
          repo.blockstore.getStream(welcomeHash),
          pull.collect((err, blocks) => {
            expect(err).to.not.exist
            expect(
              blocks[0].data.toString()
            ).to.match(
                /Hello and Welcome to IPFS/
            )
            done()
          })
        )
      })
    })
  })
}

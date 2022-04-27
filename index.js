const axios = require('axios')
const fs = require('fs')

// eslint-disable-next-line new-cap
const api = new axios.create({})

const accessToken =
  'EAAHhue81VpQBAL9un0M1QgXDZCK2VVV63OA5ZADeSkLOPSTechLNYi8Te5uHs2r7P9S2czpCJTCXxWuBVNtRIYFZAvy7gY7zGxMWZBirrwKVpOy5g0B1vreZBlQOGR8DXcOXkOErJoj2QpE7b8JsBuDJRLjZAz8qlzBH31JyHGWbHc6f5j1JjiMZASlNNXtYZCEFWa4Q08N40QZDZD'

const feedId = '17978207044464559'

async function getComments(res, url) {
  const data = (await api.get(url)).data
  const next = data?.paging?.next

  res = res.concat(
    data.data
      .filter((item) => item.replies)
      .flatMap((item) =>
        item.replies.data.map((reply) => {
          return reply.id
        })
      )
  )
  res = res.concat(data.data.map((item) => item.id))

  if (next) {
    res = await getComments(res, next)
  }

  return res
}

async function getComment(commentId) {
  return (
    await api.get(`https://graph.facebook.com/${commentId}`, {
      params: {
        access_token: accessToken,
        fields: 'username, text, timestamp'
      }
    })
  ).data
}

async function getCommentedUsers() {
  const res = []
  const commentIds = await getComments(
    res,
    `https://graph.facebook.com/${feedId}/comments?access_token=${accessToken}&fields=id,replies`
  )
  const commentMetadata = {}

  for (const commentId of commentIds) {
    const { username, text, timestamp } = await getComment(commentId)
    const taggedUsers = text.match(/@([a-z._0-9])+/g)

    if (taggedUsers !== null) {
      const taggedUsernames = taggedUsers.map((taggedUser) =>
        taggedUser.slice(1)
      )
      commentMetadata[username] = commentMetadata[username] ?? {
        username,
        tagged: new Set(),
        timestamp: ''
      }
      commentMetadata[username].tagged = new Set(
        Array.from(commentMetadata[username].tagged).concat(taggedUsernames)
      )
      commentMetadata[username].timestamp = timestamp
    }
  }

  const commentMetadataArray = Object.values(commentMetadata).sort((a, b) =>
    a.timestamp > b.timestamp ? 1 : a.timestamp < b.timestamp ? -1 : 0
  )

  for (const [index, metadata] of commentMetadataArray.entries()) {
    const { username, tagged, timestamp } = metadata

    Array.from(tagged).forEach((taggedUsername) => {
      commentMetadata[taggedUsername]?.tagged?.delete(username)
    })
  }

  fs.writeFileSync(
    'user_candidates_metadata.json',
    JSON.stringify(
      commentMetadataArray.filter((metadata) => metadata.tagged.size > 0)
    )
  )
  fs.writeFileSync(
    'user_candidates.txt',
    commentMetadataArray
      .filter((metadata) => metadata.tagged.size > 0)
      .map((metadata) => metadata.username)
      .join(', ')
  )

  return commentMetadataArray
    .filter((metadata) => metadata.tagged.size > 0)
    .map((metadata) => metadata.username)
}

async function main() {
  const commentedUsers = await getCommentedUsers()
  console.log(commentedUsers)
}

main().catch(console.error)

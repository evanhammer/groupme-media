import 'babel-polyfill';
import fs from 'fs';
import Promise from 'bluebird';
import fetch from 'node-fetch';

// replace callbacks with Promises
Promise.promisifyAll(fs);

const GROUPME_BASE_URL = 'https://api.groupme.com/v3';
const DIRECTORY_NAME = 'groups';
const TOKEN = process.env.npm_config_token;
const MAX_GROUPS = 100;

const log = text => process.stdout.write(`${text}\n`);

const fetchGroupMe = (path, query = {}) => {
  const queryString = Object.keys(query).reduce(
    (s, k) => `${s}&${k}=${encodeURIComponent(query[k])}`,
    `token=${TOKEN}`
  );
  console.log('FETCHING', path, queryString);

  return fetch(`${GROUPME_BASE_URL}${path}?${queryString}`)
    .then(response => {
      if (response.status === 304) {
        throw { name: 'NoResults' };
      } else {
        return response.json();
      }
    })
    .then(json => json.response);
};

const createDirectory = dir => (
  // create groupme directory if it doens't exist
  fs.mkdirAsync(dir)
    .then(() => {
      log(`Created "${dir}" directory.`);
    })
    .catch((err) => {
      if (err.code === 'EEXIST') {
        log(`"${dir}" directory already exists.`);
      } else {
        throw err;
      }
    })
);

const getAllGroups = () => (
  fetchGroupMe('/groups', { per_page: MAX_GROUPS })
    .then(groups => groups.map(group => ({ id: group.id, name: group.name })))
);

const getMedia = (groupID, beforeID, media = []) => {
  const params = { limit: 100 };
  if (beforeID !== undefined) {
    params.before_id = beforeID;
  }

  return fetchGroupMe(`/groups/${groupID}/messages`, params)
    .then(messagesWrapper => {
      const messages = messagesWrapper.messages;
      Array.prototype.push.apply(
        media,
        messages.filter(message => message.attachments.length > 0)
      );
      return getMedia(groupID, messages[messages.length - 1].id, media);
    })
    .catch(err => {
      if (err.name === 'NoResults') {
        return media;
      } else {
        throw err;
      }
    });
};

createDirectory(DIRECTORY_NAME)
  .then(getAllGroups)
  .then(groups => groups[0].id)
  .then(getMedia)
  .then(media => {
    console.log('this then', media.length);
  });

// for each group get all messages
// index through the messages to get media content
// save media content

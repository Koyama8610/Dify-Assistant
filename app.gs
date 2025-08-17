const SLACK_VERIFICATION_TOKEN = 'AGxZVhJaKJYiBB4wB2TCR49U';
const SLACK_BOT_TOKEN = 'xoxb-7519249008082-9359342245875-RjE9T5PvRfnQfRQkdo3CFlC8';
const DIFY_API_KEY = 'app-DxmeyxjqCafshoDaBE5JFEX3';
const DIFY_API_URL = 'https://api.dify.ai/v1/chat-messages';

function doPost(e) {
  const params = e.parameter;

  if (params.token !== SLACK_VERIFICATION_TOKEN) {
    throw new Error('Invalid Token');
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('userQuery', params.text);
  scriptProperties.setProperty('channelId', params.channel_id);
  scriptProperties.setProperty('userId', params.user_id);

  const immediateResponse = {
    "response_type": "ephemeral",
    "text": `🤖 質問「${params.text}」を受け付けました。AIが回答を生成中です...`
  };
  
  ScriptApp.newTrigger('processDifyRequest')
    .timeBased()
    .after(1)
    .create();

  return ContentService.createTextOutput(JSON.stringify(immediateResponse))
    .setMimeType(ContentService.MimeType.JSON);
}

function processDifyRequest(e) {
  if (e && e.triggerUid) {
    const allTriggers = ScriptApp.getProjectTriggers();
    for (const trigger of allTriggers) {
      if (trigger.getUniqueId() === e.triggerUid) {
        ScriptApp.deleteTrigger(trigger);
        break;
      }
    }
  }

  const scriptProperties = PropertiesService.getScriptProperties();
  const userQuery = scriptProperties.getProperty('userQuery');
  const channelId = scriptProperties.getProperty('channelId');
  const userId = scriptProperties.getProperty('userId');

  const difyResponse = callDifyAPI(userQuery);
  
  postMessageToSlack(channelId, userId, userQuery, difyResponse);
  
  scriptProperties.deleteAllProperties();
}

function callDifyAPI(query) {
  const headers = {
    'Authorization': 'Bearer ' + DIFY_API_KEY,
    'Content-Type': 'application/json'
  };
  const payload = {
    'inputs': {},
    'query': query,
    'user': 'slack-user-' + Date.now(),
    'response_mode': 'blocking'
  };
  const options = {
    'method': 'post',
    'headers': headers,
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  try {
    const response = UrlFetchApp.fetch(DIFY_API_URL, options);
    const responseData = JSON.parse(response.getContentText());
    if (responseData.answer) {
      return responseData.answer;
    } else {
      console.error('Dify API Error:', responseData);
      return '申し訳ありません、Difyから回答を取得できませんでした。';
    }
  } catch (e) {
    console.error('Fetch Error:', e);
    return 'エラーが発生しました。システム管理者に確認してください。';
  }
}

function postMessageToSlack(channelId, userId, query, answer) {
  const SLACK_API_URL = 'https://slack.com/api/chat.postMessage';
  
  const payload = {
    'channel': channelId,
    'text': `<@${userId}>さんからの質問「${query}」への回答です。`,
    'blocks': [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `<@${userId}>さんからの質問:\n>*${query}*`
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `🤖 AIアシスタントからの回答:\n${answer}`
        }
      }
    ]
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json; charset=utf-8',
    'headers': {
      'Authorization': 'Bearer ' + SLACK_BOT_TOKEN
    },
    'payload': JSON.stringify(payload)
  };

  UrlFetchApp.fetch(SLACK_API_URL, options);
}

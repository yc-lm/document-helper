/**
 * @name: MyWebsocket.ts
 * @author: yangcongcong
 * @date: 2025/5/14
 * @description: 描述
 */
import isFunction from 'lodash/isFunction';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { KeyValue } from '../global';

const WS_ON_OPEN = 'WS_ON_OPEN';
const WS_ON_MESSAGE = 'WS_ON_MESSAGE';
const WS_ON_CLOSE = 'WS_ON_CLOSE';
const WS_ON_ERROR = 'WS_ON_ERROR';
// 其它页面触发ws消息
const WS_SEND_MESSAGE = 'WS_SEND_MESSAGE';

const EVENT_NAME = {
  open: WS_ON_OPEN,
  message: WS_ON_MESSAGE,
  close: WS_ON_CLOSE,
  error: WS_ON_ERROR,
};

const env = import.meta.env.MODE || 'development';

class Api {
  options = {
    debug: env === 'development',
  };

  ws: KeyValue | null = null;

  url = '';

  eventCollection: KeyValue = {};

  supportEvent = ['open', 'close', 'message', 'error'];

  constructor(url: string, options: KeyValue, event: KeyValue) {
    this.options = { ...this.options, ...options };
    this.url = url;

    this.registerEvent(event);
  }

  registerEvent(eventCollection: KeyValue) {
    const eventLen = this.supportEvent.length;

    for (let i = 0; i < eventLen; i++) {
      const eventName = this.supportEvent[i];

      const customCallback = eventCollection[eventName];
      if (customCallback && isFunction(customCallback)) {
        this.eventCollection[eventName] = customCallback;
      } else {
        this.eventCollection[eventName] = (e: KeyValue) => {
          window.dispatchEvent(new CustomEvent(EVENT_NAME[eventName], { detail: e }));
        };
      }
    }
  }

  connect() {
    this.ws = new ReconnectingWebSocket(this.url, [], this.options);
    this.addEvent();
  }

  onOpen(e: KeyValue) {
    this.eventCollection.open(e);
  }

  onMessage(e: KeyValue) {
    const message = e.data;
    try {
      const data = JSON.parse(message);
      this.eventCollection.message(data);
    } catch (error) {
      console.log();
    }
  }

  onClose(e: KeyValue) {
    this.eventCollection.close(e);
    this.removeEvent();
  }

  onError(e: KeyValue) {
    this.eventCollection.error(e);
    this.removeEvent();
  }

  send(message: KeyValue) {
    return this.ws.send(message);
  }

  close(reason: KeyValue) {
    return this.ws.close(reason);
  }

  addEvent() {
    this.ws.addEventListener('message', this.onMessage.bind(this));
    this.ws.addEventListener('open', this.onOpen.bind(this));
    this.ws.addEventListener('close', this.onClose.bind(this));
    this.ws.addEventListener('error', this.onError.bind(this));
  }

  removeEvent() {
    this.ws.removeEventListener('message', this.onMessage.bind(this));
    this.ws.removeEventListener('open', this.onOpen.bind(this));
    this.ws.removeEventListener('close', this.onClose.bind(this));
    this.ws.removeEventListener('error', this.onError.bind(this));
  }

  getState() {
    return this.ws?.readyState;
  }
}

function connect(url: string, options: any, event = {}) {
  const api = new Api(url, options, event);
  api.connect();
  return api;
}

function sendWsMessage(message: any) {
  window.dispatchEvent(
    new CustomEvent(WS_SEND_MESSAGE, {
      detail: message,
    }),
  );
}

function registerSendEvent(callback: any) {
  window.addEventListener(WS_SEND_MESSAGE, callback);
}

function removeSendEvent(callback: any) {
  window.removeEventListener(WS_SEND_MESSAGE, callback);
}

function registerOnMessageEvent(callback: any) {
  window.addEventListener(EVENT_NAME.message, callback);
}

function removeOnMessageEvent(callback: any) {
  window.removeEventListener(EVENT_NAME.message, callback);
}

export default {
  EVENT_NAME,
  sendWsMessage,
  connect,
  registerSendEvent,
  removeSendEvent,
  registerOnMessageEvent,
  removeOnMessageEvent,
};

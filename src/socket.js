const pingMessage = () => {
  return { ping: (+new Date()).toString() }
}
const pingReturnKey = 'tong'
export function useWebSocket(
  url, options,captureError
) {
  const {
    onConnected,
    onDisconnected,
    onError,
    onMessage,
    immediate = true,
    autoClose = true,
    protocols = [],
    interval = 30 * 1000,
  } = options

  const data = ref(null)
  const status = ref('CLOSED')
  const wsRef = ref()
  const urlRef = ref(url)
  const messages = new Map()
  let explicitlyClosed = false, timer = null

  const close = (code = 1000, reason) => {
    if (!wsRef.value) return
    explicitlyClosed = true
    messages.clear()
    wsRef.value.close(code, reason)
  }

  const send = (data, callBack) => {
    const channel = data['channel']
    if (data?.event?.includes('addChannel')) {
      if (!messages.has(channel)) {
        messages.set(channel, { data, callBack })
      }
    } else if (data?.event?.includes('removeChannel')) {
      if (messages.has(channel)) {
        messages.delete(channel)
      }
    }
    wsRef.value?.send(JSON.stringify(data))
    return true
  }

  const _init = () => {
    if (explicitlyClosed || typeof urlRef.value === 'undefined')
      return
    const ws = new WebSocket(urlRef.value, protocols)
    wsRef.value = ws
    status.value = 'CONNECTING'

    ws.onopen = () => {
      status.value = 'OPEN'
      onConnected?.(ws)
      if (messages.size > 0) {
        messages.forEach((value) => {
          send(value.data)
        })
      }
    }

    ws.onclose = (ev) => {
      status.value = 'CLOSED'
      wsRef.value = undefined
      onDisconnected?.(ws, ev)
      if (!explicitlyClosed) {
        setTimeout(_init, interval)
      }
    }

    ws.onerror = (e) => {
      captureError?.(e, { url: urlRef.value })
      onError?.(ws, e)
    }

    ws.onmessage = (e) => {
      const res = JSON.parse(e.data)
      if (res[pingReturnKey]) {
        return
      }
      if (messages.has(res.channel)) {
        if(res.success){
          if(res.first === '0'){
            res.data=res.ticker
          }
          messages.get(res.channel).callBack?.(res)
        }else{
          captureError?.(res, { url: res.channel })
        }
      }
      data.value = res
      onMessage?.(ws, e)
    }
    if (timer) clearInterval(timer)
    timer = setInterval(
      () => {
        send(pingMessage(), false)
      },
      interval,
    )

    if (autoClose) {
      window.addEventListener('beforeunload', () => close())
    }
  }
  const open = () => {
    close()
    explicitlyClosed = false
    _init()
  }
  const subscribe = (channel,callback) => {
    if (!messages.has(channel)) {
      send({ event: 'addChannel', channel },callback)
    }
  }
  const unsubscribe = (channel) => {
    if (messages.has(channel)) {
      send({ event: 'removeChannel', channel })
      messages.delete(channel)
    }
  }

  if (immediate) open()
  return {
    data,
    status,
    close,
    send,
    open,
    ws: wsRef,
    unsubscribe,
    subscribe
  }

}

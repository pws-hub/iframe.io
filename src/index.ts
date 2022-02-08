
import type { Options, RegisteredEvents, Peer, Message, MessageData, Listener } from './@types'

export default class IFrameIO {

  Events: RegisteredEvents
  peer: Peer
  options: Options

  constructor( options: Options ){

    if( options && typeof options !== 'object' )
      throw new Error('Invalid Options')
    
    this.options = options
	  this.Events = {}
    this.peer = { type: 'IFRAME' }

    if( options.type ) this.peer.type = options.type
  }

  debug( ...args: any[] ){ this.options && this.options.debug && console.log( ...args ) }

  initiate( contentWindow: MessageEventSource, iframeOrigin: string ){
    // Establish a connection with an iframe containing in the current window
    if( !contentWindow || !iframeOrigin )
      throw new Error('Invalid Connection initiation arguments')
    
    if( this.peer.type === 'IFRAME' )
      throw new Error('Expect IFRAME to <listen> and WINDOW to <initiate> a connection')

    this.peer.source = contentWindow as Window
    this.peer.origin = iframeOrigin
    
    window.addEventListener( 'message', ({ origin, data, source }) => {
      // Check valid message
      if( origin !== this.peer.origin
          || !source
          || typeof data !== 'object'
          || !data.hasOwnProperty('_event') ) return
          
      const { _event, payload } = data as Message['data']
      this.debug( `[${this.peer.type}] Message: ${_event}`, payload || '' )

      // Handshake or availability check events
      if( _event == 'pong' ) return
      
      // Volatile event
			if( !this.Events[ _event ] )
        return this.debug(`[${this.peer.type}] No <${_event}> listener defined`)

      // Trigger listeners
			this.Events[ _event ].map( fn => fn( payload ) )
      // Delete once event listeners
      delete this.Events[ _event +'--@once']
    }, false )

    this.debug(`[${this.peer.type}] Initiate connection: IFrame origin <${iframeOrigin}>`)
    this.emit('ping')
  }

  listen( hostOrigin?: string ){
    // Listening to connection from the content window
    
    this.peer.type = 'IFRAME' // iframe.io connection listener is automatically set as IFRAME
    this.debug(`[${this.peer.type}] Listening to connect${hostOrigin ? `: Host <${hostOrigin}>` : ''}`)

    window.addEventListener( 'message', ({ origin, data, source }) => {
      // Check host origin where event must only come from.
      if( hostOrigin && hostOrigin !== origin )
        throw new Error('Invalid Event Origin')
        
      // Check valid message
      if( !source
          || typeof data !== 'object'
          || !data.hasOwnProperty('_event') ) return

      // Define peer source window and origin
      if( !this.peer.source ){
        this.peer = { ...this.peer, source: source as Window, origin }
        this.debug(`[${this.peer.type}] Connect to ${origin}`)
      }

      // Origin different from handshaked source origin
      else if( origin !== this.peer.origin )
        throw new Error('Invalid Origin')
      
      const { _event, payload } = data
      this.debug( `[${this.peer.type}] Message: ${_event}`, payload || '' )

      // Handshake or availability check events
      if( _event == 'ping' ) return this.emit('pong')
      
      // Volatile event
			if( !this.Events[ _event ] )
        return this.debug(`[${this.peer.type}] No <${_event}> listener defined`)

      // Trigger listeners
			this.Events[ _event ].map( fn => fn( payload ) )
      // Delete once event listeners
      delete this.Events[ _event +'--@once']
    }, false )
  }

  emit( _event: string, payload?: MessageData['payload'], fn?: Listener ){

    if( !this.peer.source )
      throw new Error('No Connection initiated')

		if( typeof payload == 'function' ){
			fn = payload
			payload = null
		}
    
    this.peer.source.postMessage( JSON.parse( JSON.stringify({ _event, payload }) ), this.peer.origin as string )

    // Acknowledge/callback event listener
		if( typeof fn == 'function' ) this.once( _event, fn )

		return this
  }
  
  on( _event: string, fn: Listener ){
		// Add Event listener
		if( !this.Events[ _event ] ) this.Events[ _event ] = []
		this.Events[ _event ].push( fn )
    
    this.debug(`[${this.peer.type}] New <${_event}> listener on`)
		return this
	}
  
  once( _event: string, fn: Listener ){
		// Add Once Event listener
    _event += '--@once'

		if( !this.Events[ _event ] ) this.Events[ _event ] = []
		this.Events[ _event ].push( fn )
    
    this.debug(`[${this.peer.type}] New <${_event} once> listener on`)
		return this
	}

	off( _event: string, fn: Listener ){
		// Remove Event listener
		delete this.Events[ _event ]
		typeof fn == 'function' && fn()
    
    this.debug(`[${this.peer.type}] <${_event}> listener off`)
		return this
	}

	removeListeners( fn: Listener ){
    // Clear all event listeners
		this.Events = {}
		typeof fn == 'function' && fn()

    this.debug(`[${this.peer.type}] All listeners removed`)
		return this
	}
}

/**
 * Require the given path.
 *
 * @param {String} path
 * @return {Object} exports
 * @api public
 */

function require(path, parent, orig) {
  var resolved = require.resolve(path);

  // lookup failed
  if (null == resolved) {
    orig = orig || path;
    parent = parent || 'root';
    var err = new Error('Failed to require "' + orig + '" from "' + parent + '"');
    err.path = orig;
    err.parent = parent;
    err.require = true;
    throw err;
  }

  var module = require.modules[resolved];

  // perform real require()
  // by invoking the module's
  // registered function
  if (!module.exports) {
    module.exports = {};
    module.client = module.component = true;
    module.call(this, module.exports, require.relative(resolved), module);
  }

  return module.exports;
}

/**
 * Registered modules.
 */

require.modules = {};

/**
 * Registered aliases.
 */

require.aliases = {};

/**
 * Resolve `path`.
 *
 * Lookup:
 *
 *   - PATH/index.js
 *   - PATH.js
 *   - PATH
 *
 * @param {String} path
 * @return {String} path or null
 * @api private
 */

require.resolve = function(path) {
  if (path.charAt(0) === '/') path = path.slice(1);
  var index = path + '/index.js';

  var paths = [
    path,
    path + '.js',
    path + '.json',
    path + '/index.js',
    path + '/index.json'
  ];

  for (var i = 0; i < paths.length; i++) {
    var path = paths[i];
    if (require.modules.hasOwnProperty(path)) return path;
  }

  if (require.aliases.hasOwnProperty(index)) {
    return require.aliases[index];
  }
};

/**
 * Normalize `path` relative to the current path.
 *
 * @param {String} curr
 * @param {String} path
 * @return {String}
 * @api private
 */

require.normalize = function(curr, path) {
  var segs = [];

  if ('.' != path.charAt(0)) return path;

  curr = curr.split('/');
  path = path.split('/');

  for (var i = 0; i < path.length; ++i) {
    if ('..' == path[i]) {
      curr.pop();
    } else if ('.' != path[i] && '' != path[i]) {
      segs.push(path[i]);
    }
  }

  return curr.concat(segs).join('/');
};

/**
 * Register module at `path` with callback `definition`.
 *
 * @param {String} path
 * @param {Function} definition
 * @api private
 */

require.register = function(path, definition) {
  require.modules[path] = definition;
};

/**
 * Alias a module definition.
 *
 * @param {String} from
 * @param {String} to
 * @api private
 */

require.alias = function(from, to) {
  if (!require.modules.hasOwnProperty(from)) {
    throw new Error('Failed to alias "' + from + '", it does not exist');
  }
  require.aliases[to] = from;
};

/**
 * Return a require function relative to the `parent` path.
 *
 * @param {String} parent
 * @return {Function}
 * @api private
 */

require.relative = function(parent) {
  var p = require.normalize(parent, '..');

  /**
   * lastIndexOf helper.
   */

  function lastIndexOf(arr, obj) {
    var i = arr.length;
    while (i--) {
      if (arr[i] === obj) return i;
    }
    return -1;
  }

  /**
   * The relative require() itself.
   */

  function localRequire(path) {
    var resolved = localRequire.resolve(path);
    return require(resolved, parent, path);
  }

  /**
   * Resolve relative to the parent.
   */

  localRequire.resolve = function(path) {
    var c = path.charAt(0);
    if ('/' == c) return path.slice(1);
    if ('.' == c) return require.normalize(p, path);

    // resolve deps by returning
    // the dep in the nearest "deps"
    // directory
    var segs = parent.split('/');
    var i = lastIndexOf(segs, 'deps') + 1;
    if (!i) i = 0;
    path = segs.slice(0, i + 1).join('/') + '/deps/' + path;
    return path;
  };

  /**
   * Check if module is defined at `path`.
   */

  localRequire.exists = function(path) {
    return require.modules.hasOwnProperty(localRequire.resolve(path));
  };

  return localRequire;
};
require.register("component-type/index.js", function(exports, require, module){

/**
 * toString ref.
 */

var toString = Object.prototype.toString;

/**
 * Return the type of `val`.
 *
 * @param {Mixed} val
 * @return {String}
 * @api public
 */

module.exports = function(val){
  switch (toString.call(val)) {
    case '[object Function]': return 'function';
    case '[object Date]': return 'date';
    case '[object RegExp]': return 'regexp';
    case '[object Arguments]': return 'arguments';
    case '[object Array]': return 'array';
    case '[object String]': return 'string';
  }

  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (val && val.nodeType === 1) return 'element';
  if (val === Object(val)) return 'object';

  return typeof val;
};

});
require.register("ForbesLindesay-ajax/index.js", function(exports, require, module){
var type = require('type');

var jsonpID = 0,
    document = window.document,
    key,
    name,
    rscript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    scriptTypeRE = /^(?:text|application)\/javascript/i,
    xmlTypeRE = /^(?:text|application)\/xml/i,
    jsonType = 'application/json',
    htmlType = 'text/html',
    blankRE = /^\s*$/

var ajax = module.exports = function(options){
  var settings = extend({}, options || {})
  for (key in ajax.settings) if (settings[key] === undefined) settings[key] = ajax.settings[key]

  ajaxStart(settings)

  if (!settings.crossDomain) settings.crossDomain = /^([\w-]+:)?\/\/([^\/]+)/.test(settings.url) &&
    RegExp.$2 != window.location.host

  var dataType = settings.dataType, hasPlaceholder = /=\?/.test(settings.url)
  if (dataType == 'jsonp' || hasPlaceholder) {
    if (!hasPlaceholder) settings.url = appendQuery(settings.url, 'callback=?')
    return ajax.JSONP(settings)
  }

  if (!settings.url) settings.url = window.location.toString()
  serializeData(settings)

  var mime = settings.accepts[dataType],
      baseHeaders = { },
      protocol = /^([\w-]+:)\/\//.test(settings.url) ? RegExp.$1 : window.location.protocol,
      xhr = ajax.settings.xhr(), abortTimeout

  if (!settings.crossDomain) baseHeaders['X-Requested-With'] = 'XMLHttpRequest'
  if (mime) {
    baseHeaders['Accept'] = mime
    if (mime.indexOf(',') > -1) mime = mime.split(',', 2)[0]
    xhr.overrideMimeType && xhr.overrideMimeType(mime)
  }
  if (settings.contentType || (settings.data && settings.type.toUpperCase() != 'GET'))
    baseHeaders['Content-Type'] = (settings.contentType || 'application/x-www-form-urlencoded')
  settings.headers = extend(baseHeaders, settings.headers || {})

  xhr.onreadystatechange = function(){
    if (xhr.readyState == 4) {
      clearTimeout(abortTimeout)
      var result, error = false
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status == 0 && protocol == 'file:')) {
        dataType = dataType || mimeToDataType(xhr.getResponseHeader('content-type'))
        result = xhr.responseText

        try {
          if (dataType == 'script')    (1,eval)(result)
          else if (dataType == 'xml')  result = xhr.responseXML
          else if (dataType == 'json') result = blankRE.test(result) ? null : JSON.parse(result)
        } catch (e) { error = e }

        if (error) ajaxError(error, 'parsererror', xhr, settings)
        else ajaxSuccess(result, xhr, settings)
      } else {
        ajaxError(null, 'error', xhr, settings)
      }
    }
  }

  var async = 'async' in settings ? settings.async : true
  xhr.open(settings.type, settings.url, async)

  for (name in settings.headers) xhr.setRequestHeader(name, settings.headers[name])

  if (ajaxBeforeSend(xhr, settings) === false) {
    xhr.abort()
    return false
  }

  if (settings.timeout > 0) abortTimeout = setTimeout(function(){
      xhr.onreadystatechange = empty
      xhr.abort()
      ajaxError(null, 'timeout', xhr, settings)
    }, settings.timeout)

  // avoid sending empty string (#319)
  xhr.send(settings.data ? settings.data : null)
  return xhr
}


// trigger a custom event and return false if it was cancelled
function triggerAndReturn(context, eventName, data) {
  //todo: Fire off some events
  //var event = $.Event(eventName)
  //$(context).trigger(event, data)
  return true;//!event.defaultPrevented
}

// trigger an Ajax "global" event
function triggerGlobal(settings, context, eventName, data) {
  if (settings.global) return triggerAndReturn(context || document, eventName, data)
}

// Number of active Ajax requests
ajax.active = 0

function ajaxStart(settings) {
  if (settings.global && ajax.active++ === 0) triggerGlobal(settings, null, 'ajaxStart')
}
function ajaxStop(settings) {
  if (settings.global && !(--ajax.active)) triggerGlobal(settings, null, 'ajaxStop')
}

// triggers an extra global event "ajaxBeforeSend" that's like "ajaxSend" but cancelable
function ajaxBeforeSend(xhr, settings) {
  var context = settings.context
  if (settings.beforeSend.call(context, xhr, settings) === false ||
      triggerGlobal(settings, context, 'ajaxBeforeSend', [xhr, settings]) === false)
    return false

  triggerGlobal(settings, context, 'ajaxSend', [xhr, settings])
}
function ajaxSuccess(data, xhr, settings) {
  var context = settings.context, status = 'success'
  settings.success.call(context, data, status, xhr)
  triggerGlobal(settings, context, 'ajaxSuccess', [xhr, settings, data])
  ajaxComplete(status, xhr, settings)
}
// type: "timeout", "error", "abort", "parsererror"
function ajaxError(error, type, xhr, settings) {
  var context = settings.context
  settings.error.call(context, xhr, type, error)
  triggerGlobal(settings, context, 'ajaxError', [xhr, settings, error])
  ajaxComplete(type, xhr, settings)
}
// status: "success", "notmodified", "error", "timeout", "abort", "parsererror"
function ajaxComplete(status, xhr, settings) {
  var context = settings.context
  settings.complete.call(context, xhr, status)
  triggerGlobal(settings, context, 'ajaxComplete', [xhr, settings])
  ajaxStop(settings)
}

// Empty function, used as default callback
function empty() {}

ajax.JSONP = function(options){
  if (!('type' in options)) return ajax(options)

  var callbackName = 'jsonp' + (++jsonpID),
    script = document.createElement('script'),
    abort = function(){
      //todo: remove script
      //$(script).remove()
      if (callbackName in window) window[callbackName] = empty
      ajaxComplete('abort', xhr, options)
    },
    xhr = { abort: abort }, abortTimeout

  if (options.error) script.onerror = function() {
    xhr.abort()
    options.error()
  }

  window[callbackName] = function(data){
    clearTimeout(abortTimeout)
      //todo: remove script
      //$(script).remove()
    delete window[callbackName]
    ajaxSuccess(data, xhr, options)
  }

  serializeData(options)
  script.src = options.url.replace(/=\?/, '=' + callbackName)
  //tood: append to head
  //$('head').append(script)

  if (options.timeout > 0) abortTimeout = setTimeout(function(){
      xhr.abort()
      ajaxComplete('timeout', xhr, options)
    }, options.timeout)

  return xhr
}

ajax.settings = {
  // Default type of request
  type: 'GET',
  // Callback that is executed before request
  beforeSend: empty,
  // Callback that is executed if the request succeeds
  success: empty,
  // Callback that is executed the the server drops error
  error: empty,
  // Callback that is executed on request complete (both: error and success)
  complete: empty,
  // The context for the callbacks
  context: null,
  // Whether to trigger "global" Ajax events
  global: true,
  // Transport
  xhr: function () {
    return new window.XMLHttpRequest()
  },
  // MIME types mapping
  accepts: {
    script: 'text/javascript, application/javascript',
    json:   jsonType,
    xml:    'application/xml, text/xml',
    html:   htmlType,
    text:   'text/plain'
  },
  // Whether the request is to another domain
  crossDomain: false,
  // Default timeout
  timeout: 0
}

function mimeToDataType(mime) {
  return mime && ( mime == htmlType ? 'html' :
    mime == jsonType ? 'json' :
    scriptTypeRE.test(mime) ? 'script' :
    xmlTypeRE.test(mime) && 'xml' ) || 'text'
}

function appendQuery(url, query) {
  return (url + '&' + query).replace(/[&?]{1,2}/, '?')
}

// serialize payload and append it to the URL for GET requests
function serializeData(options) {
  if (type(options.data) === 'object') options.data = param(options.data)
  if (options.data && (!options.type || options.type.toUpperCase() == 'GET'))
    options.url = appendQuery(options.url, options.data)
}

ajax.get = function(url, success){ return ajax({ url: url, success: success }) }

ajax.post = function(url, data, success, dataType){
  if (type(data) === 'function') dataType = dataType || success, success = data, data = null
  return ajax({ type: 'POST', url: url, data: data, success: success, dataType: dataType })
}

ajax.getJSON = function(url, success){
  return ajax({ url: url, success: success, dataType: 'json' })
}

var escape = encodeURIComponent

function serialize(params, obj, traditional, scope){
  var array = type(obj) === 'array';
  for (var key in obj) {
    var value = obj[key];

    if (scope) key = traditional ? scope : scope + '[' + (array ? '' : key) + ']'
    // handle data in serializeArray() format
    if (!scope && array) params.add(value.name, value.value)
    // recurse into nested objects
    else if (traditional ? (type(value) === 'array') : (type(value) === 'object'))
      serialize(params, value, traditional, key)
    else params.add(key, value)
  }
}

function param(obj, traditional){
  var params = []
  params.add = function(k, v){ this.push(escape(k) + '=' + escape(v)) }
  serialize(params, obj, traditional)
  return params.join('&').replace('%20', '+')
}

function extend(target) {
  var slice = Array.prototype.slice;
  slice.call(arguments, 1).forEach(function(source) {
    for (key in source)
      if (source[key] !== undefined)
        target[key] = source[key]
  })
  return target
}
});
require.register("MatthewMueller-debounce/index.js", function(exports, require, module){
/**
 * Debounce
 *
 * Returns a function, that, as long as it continues to be invoked, will not
 * be triggered. The function will be called after it stops being called for
 * N milliseconds. If `immediate` is passed, trigger the function on the
 * leading edge, instead of the trailing.
 *
 * @param {Function} func
 * @param {Number} wait
 * @param {Boolean} immediate
 * @return {Function}
 */

module.exports = function(func, wait, immediate) {
  var timeout, result;
  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) result = func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) result = func.apply(context, args);
    return result;
  };
};

});
require.register("jonathanong-array-parallel/index.js", function(exports, require, module){
module.exports = function parallel(fns, context, callback) {
  if (!callback) {
    if (typeof context === 'function') {
      callback = context
      context = null
    } else {
      callback = noop
    }
  }

  var pending = fns && fns.length
  if (!pending) return callback(null, []);

  var finished = false
  var results = new Array(pending)

  fns.forEach(context ? function (fn, i) {
    fn.call(context, maybeDone(i))
  } : function (fn, i) {
    fn(maybeDone(i))
  })

  function maybeDone(i) {
    return function (err, result) {
      if (finished) return;

      if (err) {
        callback(err, results)
        finished = true
        return
      }

      results[i] = result

      if (!--pending) callback(null, results);
    }
  }
}

function noop() {}

});
require.register("component-keyname/index.js", function(exports, require, module){

/**
 * Key name map.
 */

var map = {
  8: 'backspace',
  9: 'tab',
  13: 'enter',
  16: 'shift',
  17: 'ctrl',
  18: 'alt',
  20: 'capslock',
  27: 'esc',
  32: 'space',
  33: 'pageup',
  34: 'pagedown',
  35: 'end',
  36: 'home',
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  45: 'ins',
  46: 'del',
  91: 'meta',
  93: 'meta',
  224: 'meta'
};

/**
 * Return key name for `n`.
 *
 * @param {Number} n
 * @return {String}
 * @api public
 */

module.exports = function(n){
  return map[n];
};
});
require.register("pazguille-route66/index.js", function(exports, require, module){
var location = window.location,
    bind = window.addEventListener ? 'addEventListener' : 'attachEvent',
    load = window.addEventListener ? 'load' : 'onload',
    supported = (window.onpopstate !== undefined),
    updateurl = supported ? 'popstate' : load;


/**
 * Create a new Path.
 * @constructor
 * @param {string} path - The path of a route.
 * @property {string} url
 * @property {array} listeners
 * @property {string} regexp
 * @returns {Object}
 */
function Path(path) {
    this.url = path;
    this.listeners = [];
    this.toRegExp();

    return this;
}

/**
 * Converts the path string into a regexp.
 * @public
 */
Path.prototype.toRegExp = function () {
    this.regexp = new RegExp('^' + this.url.replace(/:\w+/g, '([^\\/]+)').replace(/\//g, '\\/') + '$');

    return this;
};


/**
 * Route66 Class
 */

/**
 * Create a new router.
 * @constructor
 * @property {array} paths
 * @property {string} regexp
 * @returns {Object}
 */
function Route66() {
    this.init();

    return this;
}

/**
 * Initialize a new router.
 * @constructs
 */
Route66.prototype.init = function () {
    var that = this,
        hash;

    this._collection = {};

    window[bind](updateurl, function () {
        hash = location.hash.split('#!')[1] || location.hash.split('#')[1];

        // Home
        if (location.pathname === '/' && hash === undefined) {
            that._match('/');
        } else {
            that._match(hash);
        }

    }, false);

    if (!supported) {
        window[bind]('onhashchange', function () {
            hash = location.hash.split('#!')[1] || location.hash.split('#')[1];
            that._match(hash);
        });
    }

    return this;

};

/**
 * Checks if the current hash matches with a path.
 * @param {string} hash - The current hash.
 */
Route66.prototype._match = function (hash) {
    var listeners,
        key,
        i = 0,
        path,
        params,
        len;

    for (key in this._collection) {

        if (this._collection[key] !== undefined) {

            path = this._collection[key];

            params = hash.match(path.regexp);

            if (params) {

                params.splice(0, 1);

                listeners = this._collection[key].listeners;

                len = listeners.length;

                for (i; i < len; i += 1) {
                    listeners[i].apply(undefined, params);
                }
            }

        }
    }

    return this;
};

/**
 * Creates a new path and stores its listener into the collection.
 * @param {string} path -
 * @param {funtion} listener -
 */
Route66.prototype.path = function (path, listener) {
    var key;

    if (typeof path === 'object' && listener === undefined) {

        for (key in path) {
            if (path[key] !== undefined) {
                this._createPath(key, path[key]);
            }
        }

    } else {
        this._createPath(path, listener);
    }

    return this;
};

/**
 * Creates a new path and stores its listener into the collection.
 */
Route66.prototype._createPath = function (path, listener) {
    if (this._collection[path] === undefined) {
        this._collection[path] = new Path(path);
    }

    this._collection[path].listeners.push(listener);
};

/**
 * Removes a path and its litener from the collection with the given path.
 * @param {string} path
 * @param {funtion} listener
 */
Route66.prototype.remove = function (path, listener) {
    var listeners = this._collection[path],
        i = 0,
        len = listeners.length;

    if (len !== undefined) {
        for (i; i < len; i += 1) {
            if (listeners[i] === listener) {
                listeners.splice(i, 1);
                break;
            }
        }
    }

    if (listeners.length === 0 || listener === undefined) {
        delete this._collection[path];
    }

    return this;
};

/**
 * Returns a collections of listeners with the given path or an entire collection.
 * @param {string} path
 * @return {array}
 */
Route66.prototype.paths = function (path) {
    return (path !== undefined) ? this._collection[path] : this._collection;
};


/**
 * Expose Route66
 */
exports = module.exports = Route66;
});
require.alias("ForbesLindesay-ajax/index.js", "busrouter-sg/deps/ajax/index.js");
require.alias("ForbesLindesay-ajax/index.js", "ajax/index.js");
require.alias("component-type/index.js", "ForbesLindesay-ajax/deps/type/index.js");

require.alias("MatthewMueller-debounce/index.js", "busrouter-sg/deps/debounce/index.js");
require.alias("MatthewMueller-debounce/index.js", "debounce/index.js");

require.alias("jonathanong-array-parallel/index.js", "busrouter-sg/deps/array-parallel/index.js");
require.alias("jonathanong-array-parallel/index.js", "busrouter-sg/deps/array-parallel/index.js");
require.alias("jonathanong-array-parallel/index.js", "array-parallel/index.js");
require.alias("jonathanong-array-parallel/index.js", "jonathanong-array-parallel/index.js");

require.alias("component-keyname/index.js", "busrouter-sg/deps/keyname/index.js");
require.alias("component-keyname/index.js", "keyname/index.js");

require.alias("pazguille-route66/index.js", "busrouter-sg/deps/route66/index.js");
require.alias("pazguille-route66/index.js", "route66/index.js");


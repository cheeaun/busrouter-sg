/*!
 * Yokuto.js, extremely-opinionated and super-lightweight version of Zepto.js
 *
 * Copyright 2013, Lim Chee Aun (http://cheeaun.com/)
 * Licensed under the MIT license.
 * http://cheeaun.mit-license.org/
 */

var Yokuto = (function(){
	var matchesSelector = function(element, selector){
		if (!element || element.nodeType !== 1) return false;
		var matches = element.matchesSelector || element.mozMatchesSelector || element.webkitMatchesSelector || element.oMatchesSelector || element.msMatchesSelector;
		return matches.call(element, selector);
	};

	var closest = function(element, selector){
	  var matches = false;
	  do {
		matches = matchesSelector(element, selector);
	  } while (!matches && (element = element.parentNode) && element.ownerDocument);
	  return matches ? element : false;
	};

	var Y = function(selector, context){
		if (!selector) return this;
		if (!context) context = document;
		var elements;
		if (typeof selector != 'string'){
			this.selector = '';
			elements = [selector];
		} else {
			this.selector = selector;
			elements = [].slice.call(context.querySelectorAll(selector));
		}
		var len = this.length = elements.length;
		for (var i=0; i<len; i++){
			this[i] = elements[i];
		}
		return this;
	};

	Y.prototype = {

		each: function(fn){
			var len = this.length;
			for (var i=0; i<len; i++){
				var element = this[i];
				fn.call(element, element, i);
			}
			return this;
		},

		on: function(event, selector, fn, capture){
			if (typeof selector != 'string'){
				capture = fn;
				fn = selector;
				this.each(function(element){
					element.addEventListener(event, fn, capture || false);
				});
			} else {
				this.each(function(element){
					element.addEventListener(event, function(e){
						var target = closest(e.target, selector);
						if (target) fn.call(target, e);
					}, capture || false);
				});
			}
			return this;
		},

		trigger: function(eventName){
			if (!this.length) return this;
			var el = this[0];
			var event = document.createEvent('MouseEvents');
			var clicks = (eventName == 'dblclick') ? 2 : 1;
			var button = (eventName == 'contextmenu') ? 2 : 0;
			event.initEvent(eventName, true, true, document.defaultView, clicks, 0, 0, 0, 0, false, false, false, false, button, el);
			el.dispatchEvent(event);
			return this;
		},

		find: function(selector){
			return new Y(selector, this[0]);
		},

		parent: function(){
			var el = this[0];
			return new Y(el.parentElement || el.parentNode);
		},

		next: function(){
			var el = this[0];
			return new Y(el.nextElementSibling || el.nextSibling);
		},

		prev: function(){
			var el = this[0];
			return new Y(el.previousElementSibling || el.previousSibling);
		},

		addClass: function(className){
			this.each(function(element){
				element.classList.add(className);
			});
			return this;
		},

		removeClass: function(className){
			this.each(function(element){
				element.classList.remove(className);
			});
			return this;
		},

		toggleClass: function(className){
			this.each(function(element){
				element.classList.toggle(className);
			});
			return this;
		},

		html: function(html){
			if (!this.length) return this;
			if (!html) return this[0].innerHTML;
			this[0].innerHTML = html;
			return this;
		},

		attr: function(attr){
			if (!this.length) return '';
			return this[0].getAttribute(attr);
		},

		data: function(key){
			if (!this.length) return;
			return this[0].getAttribute('data-' + key);
		},

		text: function(str){
			if (!this.length) return '';
			var el = this[0];
			if (str){
				el.textContent = str;
				return this;
			}
			return el.textContent;
		},

		focus: function(){
			this.length && this[0].focus && this[0].focus();
			return this;
		},

		blur: function(){
			this.length && this[0].blur && this[0].blur();
			return this;
		}

	};

	return function(selector){
		return new Y(selector);
	};
})();

'$' in window || (window.$ = Yokuto);
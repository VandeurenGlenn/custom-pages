var CustomPages = (function () {
  'use strict';

  window.Backed = window.Backed || {};
  // binding does it's magic using the propertyStore ...
  window.Backed.PropertyStore = window.Backed.PropertyStore || new Map();

  // TODO: Create & add global observer
  var PropertyMixin = base => {
    return class PropertyMixin extends base {
      static get observedAttributes() {
        return Object.entries(this.properties).map(entry => {if (entry[1].reflect) {return entry[0]} else return null});
      }

      get properties() {
        return customElements.get(this.localName).properties;
      }

      constructor() {
        super();
        if (this.properties) {
          for (const entry of Object.entries(this.properties)) {
            const { observer, reflect, renderer } = entry[1];
            // allways define property even when renderer is not found.
            this.defineProperty(entry[0], entry[1]);
          }
        }
      }

      connectedCallback() {
        if (super.connectedCallback) super.connectedCallback();
        if (this.attributes)
          for (const attribute of this.attributes) {
            if (String(attribute.name).includes('on-')) {
              const fn = attribute.value;
              const name = attribute.name.replace('on-', '');
              this.addEventListener(String(name), event => {
                let target = event.path[0];
                while (!target.host) {
                  target = target.parentNode;
                }
                if (target.host[fn]) {
                  target.host[fn](event);
                }
              });
            }
        }
      }

      attributeChangedCallback(name, oldValue, newValue) {
        this[name] = newValue;
      }

      /**
       * @param {function} options.observer callback function returns {instance, property, value}
       * @param {boolean} options.reflect when true, reflects value to attribute
       * @param {function} options.render callback function for renderer (example: usage with lit-html, {render: render(html, shadowRoot)})
       */
      defineProperty(property = null, {strict = false, observer, reflect = false, renderer, value}) {
        Object.defineProperty(this, property, {
          set(value) {
            if (value === this[`___${property}`]) return;
            this[`___${property}`] = value;

            if (reflect) {
              if (value) this.setAttribute(property, String(value));
              else this.removeAttribute(property);
            }

            if (observer) {
              if (observer in this) this[observer]();
              else console.warn(`observer::${observer} undefined`);
            }

            if (renderer) {
              const obj = {};
              obj[property] = value;
              if (renderer in this) this.render(obj, this[renderer]);
              else console.warn(`renderer::${renderer} undefined`);
            }

          },
          get() {
            return this[`___${property}`];
          },
          configurable: strict ? false : true
        });
        // check if attribute is defined and update property with it's value
        // else fallback to it's default value (if any)
        const attr = this.getAttribute(property);
        this[property] = attr || this.hasAttribute(property) || value;
      }
    }
  }

  /**
   * @mixin Backed
   * @module utils
   * @export merge
   *
   * some-prop -> someProp
   *
   * @param {object} object The object to merge with
   * @param {object} source The object to merge
   * @return {object} merge result
   */
  var merge = (object = {}, source = {}) => {
    // deep assign
    for (const key of Object.keys(object)) {
      if (source[key]) {
        Object.assign(object[key], source[key]);
      }
    }
    // assign the rest
    for (const key of Object.keys(source)) {
      if (!object[key]) {
        object[key] = source[key];
      }
    }
    return object;
  }

  var SelectMixin = base => {
    return class SelectMixin extends PropertyMixin(base) {

      static get properties() {
        return merge(super.properties, {
          selected: {
            value: 0,
            observer: '__selectedObserver__'
          }
        });
      }

      constructor() {
        super();
      }

      get slotted() {
        return this.shadowRoot ? this.shadowRoot.querySelector('slot') : this;
      }

      get _assignedNodes() {
        const nodes = 'assignedNodes' in this.slotted ? this.slotted.assignedNodes() : this.children;
        const arr = [];
        for (var i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          if (node.nodeType === 1) arr.push(node);
        }
        return arr;
      }

      /**
      * @return {String}
      */
      get attrForSelected() {
        return this.getAttribute('attr-for-selected') || 'name';
      }

      set attrForSelected(value) {
        this.setAttribute('attr-for-selected', value);
      }

      attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
          // check if value is number
          if (!isNaN(newValue)) {
            newValue = Number(newValue);
          }
          this[name] = newValue;
        }
      }

      /**
       * @param {string|number|HTMLElement} selected
       */
      select(selected) {
        if (selected) this.selected = selected;
        // TODO: fix selectedobservers
        if (this.multi) this.__selectedObserver__();
      }

      next(string) {
        const index = this.getIndexFor(this.currentSelected);
        if (index !== -1 && index >= 0 && this._assignedNodes.length > index &&
            (index + 1) <= this._assignedNodes.length - 1) {
          this.selected = this._assignedNodes[index + 1];
        }
      }

      previous() {
        const index = this.getIndexFor(this.currentSelected);
        if (index !== -1 && index >= 0 && this._assignedNodes.length > index &&
            (index - 1) >= 0) {
          this.selected = this._assignedNodes[index - 1];
        }
      }

      getIndexFor(element) {
        if (element && element instanceof HTMLElement === false)
          return console.error(`${element} is not an instanceof HTMLElement`);

        return this._assignedNodes.indexOf(element || this.selected);
      }

      _updateSelected(selected) {
        selected.classList.add('custom-selected');
        if (this.currentSelected && this.currentSelected !== selected) {
          this.currentSelected.classList.remove('custom-selected');
        }
        this.currentSelected = selected;
      }

      /**
       * @param {string|number|HTMLElement} change.value
       */
      __selectedObserver__(value) {
        const type = typeof this.selected;
        if (Array.isArray(this.selected)) {
          for (const child of this._assignedNodes) {
            if (child.nodeType === 1) {
              if (this.selected.indexOf(child.getAttribute(this.attrForSelected)) !== -1) {
                child.classList.add('custom-selected');
              } else {
                child.classList.remove('custom-selected');
              }
            }
          }
          return;
        } else if (type === 'object') return this._updateSelected(this.selected);
        else if (type === 'string') {
          for (const child of this._assignedNodes) {
            if (child.nodeType === 1) {
              if (child.getAttribute(this.attrForSelected) === this.selected) {
                return this._updateSelected(child);
              }
            }
          }
        } else {
          // set selected by index
          const child = this._assignedNodes[this.selected];
          if (child && child.nodeType === 1) this._updateSelected(child);
          // remove selected even when nothing found, better to return nothing
        }
      }
    }
  }

  /**
   * @extends HTMLElement
   */
  class CustomPages extends SelectMixin(HTMLElement) {
    constructor() {
      super();
      this.slotchange = this.slotchange.bind(this);
      this.attachShadow({mode: 'open'});
      this.shadowRoot.innerHTML = `
      <style>
        :host {
          flex: 1;
          position: relative;
          --primary-background-color: #ECEFF1;
          overflow: hidden;
        }
        ::slotted(*) {
          display: flex;
          position: absolute;
          opacity: 0;
          pointer-events: none;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          transition: transform ease-out 160ms, opacity ease-out 60ms;
          /*transform: scale(0.5);*/
          transform-origin: left;
        }
        ::slotted(.animate-up) {
          transform: translateY(-120%);
        }
        ::slotted(.animate-down) {
          transform: translateY(120%);
        }
        ::slotted(.custom-selected) {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
          transition: transform ease-in 160ms, opacity ease-in 320ms;
          max-height: 100%;
          max-width: 100%;
        }
      </style>
      <!-- TODO: scale animation, ace doesn't resize that well ... -->
      <div class="wrapper">
        <slot></slot>
      </div>
    `;
    }

    connectedCallback() {
      super.connectedCallback();
      this.shadowRoot.querySelector('slot').addEventListener('slotchange', this.slotchange);
    }

    isEvenNumber(number) {
      return Boolean(number % 2 === 0)
    }

    /**
     * set animation class when slot changes
     */
    slotchange() {
      let call = 0;
      for (const child of this.slotted.assignedNodes()) {
        if (child && child.nodeType === 1) {
          child.style.zIndex = 99 - call;
          if (this.isEvenNumber(call++)) {
            child.classList.add('animate-down');
          } else {
            child.classList.add('animate-up');
          }
          this.dispatchEvent(new CustomEvent('child-change', {detail: child}));
        }
      }
    }
  }var customPages = customElements.define('custom-pages', CustomPages);

  return customPages;

}());

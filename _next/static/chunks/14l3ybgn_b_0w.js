(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,535162,(e,t,r)=>{var s=e.i(774202);(e=>{"use strict";var t,r,n,i,l,o,a=Object.defineProperty,u=Object.getOwnPropertyDescriptor,c=Object.getOwnPropertyNames,f=Object.prototype.hasOwnProperty,h=(e,t,r)=>new Promise((s,n)=>{var i=e=>{try{o(r.next(e))}catch(e){n(e)}},l=e=>{try{o(r.throw(e))}catch(e){n(e)}},o=e=>e.done?s(e.value):Promise.resolve(e.value).then(i,l);o((r=r.apply(e,t)).next())}),d={},p={analyzeMetafile:()=>eh,analyzeMetafileSync:()=>eg,build:()=>ea,buildSync:()=>ed,context:()=>eu,default:()=>ex,formatMessages:()=>ef,formatMessagesSync:()=>em,initialize:()=>ev,stop:()=>ey,transform:()=>ec,transformSync:()=>ep,version:()=>eo};for(var m in p)a(d,m,{get:p[m],enumerable:!0});function g(e){let r=e=>{if(null===e)s.write8(0);else if("boolean"==typeof e)s.write8(1),s.write8(+e);else if("number"==typeof e)s.write8(2),s.write32(0|e);else if("string"==typeof e)s.write8(3),s.write(t(e));else if(e instanceof Uint8Array)s.write8(4),s.write(e);else if(e instanceof Array)for(let t of(s.write8(5),s.write32(e.length),e))r(t);else{let n=Object.keys(e);for(let i of(s.write8(6),s.write32(n.length),n))s.write(t(i)),r(e[i])}},s=new y;return s.write32(0),s.write32(e.id<<1|!e.isRequest),r(e.value),v(s.buf,s.len-4,0),s.buf.subarray(0,s.len)}e.exports=((e,t,r,s)=>{if(t&&"object"==typeof t||"function"==typeof t)for(let n of c(t))f.call(e,n)||n===r||a(e,n,{get:()=>t[n],enumerable:!(s=u(t,n))||s.enumerable});return e})(a({},"__esModule",{value:!0}),d);var y=class{constructor(e=new Uint8Array(1024)){this.buf=e,this.len=0,this.ptr=0}_write(e){if(this.len+e>this.buf.length){let t=new Uint8Array((this.len+e)*2);t.set(this.buf),this.buf=t}return this.len+=e,this.len-e}write8(e){let t=this._write(1);this.buf[t]=e}write32(e){let t=this._write(4);v(this.buf,e,t)}write(e){let t=this._write(4+e.length);v(this.buf,e.length,t),this.buf.set(e,t+4)}_read(e){if(this.ptr+e>this.buf.length)throw Error("Invalid packet");return this.ptr+=e,this.ptr-e}read8(){return this.buf[this._read(1)]}read32(){return b(this.buf,this._read(4))}read(){let e=this.read32(),t=new Uint8Array(e),r=this._read(t.length);return t.set(this.buf.subarray(r,r+e)),t}};if("u">typeof TextEncoder&&"u">typeof TextDecoder){let e=new TextEncoder,s=new TextDecoder;t=t=>e.encode(t),r=e=>s.decode(e),n='new TextEncoder().encode("")'}else if(void 0!==s.Buffer)t=e=>s.Buffer.from(e),r=e=>{let{buffer:t,byteOffset:r,byteLength:n}=e;return s.Buffer.from(t,r,n).toString()},n='Buffer.from("")';else throw Error("No UTF-8 codec found");if(!(t("")instanceof Uint8Array))throw Error(`Invariant violation: "${n} instanceof Uint8Array" is incorrectly false

This indicates that your JavaScript environment is broken. You cannot use
esbuild in this environment because esbuild relies on this invariant. This
is not a problem with esbuild. You need to fix your environment instead.
`);function b(e,t){return(e[t++]|e[t++]<<8|e[t++]<<16|e[t++]<<24)>>>0}function v(e,t,r){e[r++]=t,e[r++]=t>>8,e[r++]=t>>16,e[r++]=t>>24}var w=String.fromCharCode;function x(e,t,r){let s=e[t],n=1,i=0;for(let r=0;r<t;r++)10===e[r]?(n++,i=0):i++;throw SyntaxError(r||(t===e.length?"Unexpected end of input while parsing JSON":s>=32&&s<=126?`Unexpected character ${w(s)} in JSON at position ${t} (line ${n}, column ${i})`:`Unexpected byte 0x${s.toString(16)} in JSON at position ${t} (line ${n}, column ${i})`))}var k=JSON.stringify,E="warning",_="silent";function $(e,t){let r=[];for(let s of e){if(Y(s,t),s.indexOf(",")>=0)throw Error(`Invalid ${t}: ${s}`);r.push(s)}return r.join(",")}var T=()=>null,j=e=>"boolean"==typeof e?null:"a boolean",S=e=>"string"==typeof e?null:"a string",P=e=>e instanceof RegExp?null:"a RegExp object",O=e=>"number"==typeof e&&e===(0|e)?null:"an integer",U=e=>"number"==typeof e&&e===(0|e)&&e>=0&&e<=65535?null:"a valid port number",A=e=>"function"==typeof e?null:"a function",I=e=>Array.isArray(e)?null:"an array",C=e=>Array.isArray(e)&&e.every(e=>"string"==typeof e)?null:"an array of strings",R=e=>"object"!=typeof e||null===e||Array.isArray(e)?"an object":null,D=e=>"object"==typeof e&&null!==e?null:"an array or an object",N=e=>e instanceof WebAssembly.Module?null:"a WebAssembly.Module",M=e=>"object"!=typeof e||Array.isArray(e)?"an object or null":null,F=e=>"string"==typeof e||"boolean"==typeof e?null:"a string or a boolean",V=e=>"string"!=typeof e&&("object"!=typeof e||null===e||Array.isArray(e))?"a string or an object":null,W=e=>"string"==typeof e||Array.isArray(e)&&e.every(e=>"string"==typeof e)?null:"a string or an array of strings",L=e=>"string"==typeof e||e instanceof Uint8Array?null:"a string or a Uint8Array",B=e=>"string"==typeof e||e instanceof URL?null:"a string or a URL";function G(e,t,r,s){let n=e[r];if(t[r+""]=!0,void 0===n)return;let i=s(n);if(null!==i)throw Error(`${k(r)} must be ${i}`);return n}function q(e,t,r){for(let s in e)if(!(s in t))throw Error(`Invalid option ${r}: ${k(s)}`)}function z(e){let t;if(void 0!==e)for(let r in t=Object.create(null),e){let s=e[r];if("string"==typeof s||!1===s)t[r]=s;else throw Error(`Expected ${k(r)} in mangle cache to map to either a string or false`)}return t}function J(e,t,r,s,n){let i=G(t,r,"color",j),l=G(t,r,"logLevel",S),o=G(t,r,"logLimit",O);void 0!==i?e.push(`--color=${i}`):s&&e.push("--color=true"),e.push(`--log-level=${l||n}`),e.push(`--log-limit=${o||0}`)}function Y(e,t,r){if("string"!=typeof e)throw Error(`Expected value for ${t}${void 0!==r?" "+k(r):""} to be a string, got ${typeof e} instead`);return e}function H(e,t,r){let s=G(t,r,"legalComments",S),n=G(t,r,"sourceRoot",S),i=G(t,r,"sourcesContent",j),l=G(t,r,"target",W),o=G(t,r,"format",S),a=G(t,r,"globalName",S),u=G(t,r,"mangleProps",P),c=G(t,r,"reserveProps",P),f=G(t,r,"mangleQuoted",j),h=G(t,r,"minify",j),d=G(t,r,"minifySyntax",j),p=G(t,r,"minifyWhitespace",j),m=G(t,r,"minifyIdentifiers",j),g=G(t,r,"lineLimit",O),y=G(t,r,"drop",C),b=G(t,r,"dropLabels",C),v=G(t,r,"charset",S),w=G(t,r,"treeShaking",j),x=G(t,r,"ignoreAnnotations",j),E=G(t,r,"jsx",S),_=G(t,r,"jsxFactory",S),T=G(t,r,"jsxFragment",S),U=G(t,r,"jsxImportSource",S),A=G(t,r,"jsxDev",j),I=G(t,r,"jsxSideEffects",j),D=G(t,r,"define",R),N=G(t,r,"logOverride",R),M=G(t,r,"supported",R),F=G(t,r,"pure",C),L=G(t,r,"keepNames",j),B=G(t,r,"platform",S),q=G(t,r,"tsconfigRaw",V),z=G(t,r,"absPaths",C);if(s&&e.push(`--legal-comments=${s}`),void 0!==n&&e.push(`--source-root=${n}`),void 0!==i&&e.push(`--sources-content=${i}`),l&&e.push(`--target=${$(Array.isArray(l)?l:[l],"target")}`),o&&e.push(`--format=${o}`),a&&e.push(`--global-name=${a}`),B&&e.push(`--platform=${B}`),q&&e.push(`--tsconfig-raw=${"string"==typeof q?q:JSON.stringify(q)}`),h&&e.push("--minify"),d&&e.push("--minify-syntax"),p&&e.push("--minify-whitespace"),m&&e.push("--minify-identifiers"),g&&e.push(`--line-limit=${g}`),v&&e.push(`--charset=${v}`),void 0!==w&&e.push(`--tree-shaking=${w}`),x&&e.push("--ignore-annotations"),y)for(let t of y)e.push(`--drop:${Y(t,"drop")}`);if(b&&e.push(`--drop-labels=${$(b,"drop label")}`),z&&e.push(`--abs-paths=${$(z,"abs paths")}`),u&&e.push(`--mangle-props=${el(u)}`),c&&e.push(`--reserve-props=${el(c)}`),void 0!==f&&e.push(`--mangle-quoted=${f}`),E&&e.push(`--jsx=${E}`),_&&e.push(`--jsx-factory=${_}`),T&&e.push(`--jsx-fragment=${T}`),U&&e.push(`--jsx-import-source=${U}`),A&&e.push("--jsx-dev"),I&&e.push("--jsx-side-effects"),D)for(let t in D){if(t.indexOf("=")>=0)throw Error(`Invalid define: ${t}`);e.push(`--define:${t}=${Y(D[t],"define",t)}`)}if(N)for(let t in N){if(t.indexOf("=")>=0)throw Error(`Invalid log override: ${t}`);e.push(`--log-override:${t}=${Y(N[t],"log override",t)}`)}if(M)for(let t in M){if(t.indexOf("=")>=0)throw Error(`Invalid supported: ${t}`);let r=M[t];if("boolean"!=typeof r)throw Error(`Expected value for supported ${k(t)} to be a boolean, got ${typeof r} instead`);e.push(`--supported:${t}=${r}`)}if(F)for(let t of F)e.push(`--pure:${Y(t,"pure")}`);L&&e.push("--keep-names")}function K(){let e=new Map,t=0;return{clear(){e.clear()},load:t=>e.get(t),store(r){if(void 0===r)return -1;let s=t++;return e.set(s,r),s}}}function X(e,t,r){let s,n=!1;return()=>{if(n)return s;n=!0;try{let n=(e.stack+"").split("\n");n.splice(1,1);let i=Z(t,n,r);if(i)return s={text:e.message,location:i}}catch(e){}}}function Q(e,t,r,s,n){let i="Internal error",l=null;try{i=(e&&e.message||e)+""}catch(e){}try{l=Z(t,(e.stack+"").split("\n"),"")}catch(e){}return{id:"",pluginName:n,text:i,location:l,notes:s?[s]:[],detail:r?r.store(e):-1}}function Z(e,r,s){let n="    at ";if(e.readFileSync&&!r[0].startsWith(n)&&r[1].startsWith(n))for(let i=1;i<r.length;i++){let l=r[i];if(l.startsWith(n))for(l=l.slice(n.length);;){let n=/^(?:new |async )?\S+ \((.*)\)$/.exec(l);if(n||(n=/^eval at \S+ \((.*)\)(?:, \S+:\d+:\d+)?$/.exec(l))){l=n[1];continue}if(n=/^(\S+):(\d+):(\d+)$/.exec(l)){let i;try{i=e.readFileSync(n[1],"utf8")}catch(e){break}let l=i.split(/\r\n|\r|\n|\u2028|\u2029/)[n[2]-1]||"",o=n[3]-1,a=l.slice(o,o+s.length)===s?s.length:0;return{file:n[1],namespace:"file",line:+n[2],column:t(l.slice(0,o)).length,length:t(l.slice(o,o+a)).length,lineText:l+"\n"+r.slice(1).join("\n"),suggestion:""}}break}}return null}function ee(e,t,r){let s=Error(e+=t.length<1?"":` with ${t.length} error${t.length<2?"":"s"}:`+t.slice(0,6).map((e,t)=>{if(5===t)return"\n...";if(!e.location)return`
error: ${e.text}`;let{file:r,line:s,column:n}=e.location,i=e.pluginName?`[plugin: ${e.pluginName}] `:"";return`
${r}:${s}:${n}: ERROR: ${i}${e.text}`}).join(""));for(let[e,n]of[["errors",t],["warnings",r]])Object.defineProperty(s,e,{configurable:!0,enumerable:!0,get:()=>n,set:t=>Object.defineProperty(s,e,{configurable:!0,enumerable:!0,value:t})});return s}function et(e,t){for(let r of e)r.detail=t.load(r.detail);return e}function er(e,t,r){if(null==e)return null;let s={},n=G(e,s,"file",S),i=G(e,s,"namespace",S),l=G(e,s,"line",O),o=G(e,s,"column",O),a=G(e,s,"length",O),u=G(e,s,"lineText",S),c=G(e,s,"suggestion",S);if(q(e,s,t),u){let e=u.slice(0,(o&&o>0?o:0)+(a&&a>0?a:0)+(r&&r>0?r:80));/[\x7F-\uFFFF]/.test(e)||/\n/.test(u)||(u=e)}return{file:n||"",namespace:i||"",line:l||0,column:o||0,length:a||0,lineText:u||"",suggestion:c||""}}function es(e,t,r,s,n){let i=[],l=0;for(let o of e){let e={},a=G(o,e,"id",S),u=G(o,e,"pluginName",S),c=G(o,e,"text",S),f=G(o,e,"location",M),h=G(o,e,"notes",I),d=G(o,e,"detail",T),p=`in element ${l} of "${t}"`;q(o,e,p);let m=[];if(h)for(let e of h){let t={},r=G(e,t,"text",S),s=G(e,t,"location",M);q(e,t,p),m.push({text:r||"",location:er(s,p,n)})}i.push({id:a||"",pluginName:u||s,text:c||"",location:er(f,p,n),notes:m,detail:r?r.store(d):-1}),l++}return i}function en(e,t){let r=[];for(let s of e){if("string"!=typeof s)throw Error(`${k(t)} must be an array of strings`);r.push(s)}return r}function ei({path:e,contents:t,hash:s}){let n=null;return{path:e,contents:t,hash:s,get text(){let e=this.contents;return(null===n||e!==t)&&(t=e,n=r(e)),n}}}function el(e){let t=e.source;return e.flags&&(t=`(?${e.flags})${t}`),t}var eo="0.27.7",ea=e=>eb().build(e),eu=e=>eb().context(e),ec=(e,t)=>eb().transform(e,t),ef=(e,t)=>eb().formatMessages(e,t),eh=(e,t)=>eb().analyzeMetafile(e,t),ed=()=>{throw Error('The "buildSync" API only works in node')},ep=()=>{throw Error('The "transformSync" API only works in node')},em=()=>{throw Error('The "formatMessagesSync" API only works in node')},eg=()=>{throw Error('The "analyzeMetafileSync" API only works in node')},ey=()=>(l&&l(),Promise.resolve()),eb=()=>{if(o)return o;if(i)throw Error('You need to wait for the promise returned from "initialize" to be resolved before calling this');throw Error('You need to call "initialize" before calling this')},ev=e=>{var t;let r,s,n,l;s=G(t=e||{},r=Object.create(null),"wasmURL",B),n=G(t,r,"wasmModule",N),l=G(t,r,"worker",j),q(t,r,"in initialize() call");let o=(e={wasmURL:s,wasmModule:n,worker:l}).wasmURL,a=e.wasmModule,u=!1!==e.worker;if(!o&&!a)throw Error('Must provide either the "wasmURL" option or the "wasmModule" option');if(i)throw Error('Cannot call "initialize" more than once');return(i=ew(o||"",a,u)).catch(()=>{i=void 0}),i},ew=(e,s,n)=>h(null,null,function*(){var a;let u,c,f,p,m,v,N,M,V,B,Z,er,eo,ea,eu,ec=new Promise(e=>c=e);if(n){let e=new Blob([`onmessage=((postMessage) => {
      // Copyright 2018 The Go Authors. All rights reserved.
      // Use of this source code is governed by a BSD-style
      // license that can be found in the LICENSE file.
      var __async = (__this, __arguments, generator) => {
        return new Promise((resolve, reject) => {
          var fulfilled = (value) => {
            try {
              step(generator.next(value));
            } catch (e) {
              reject(e);
            }
          };
          var rejected = (value) => {
            try {
              step(generator.throw(value));
            } catch (e) {
              reject(e);
            }
          };
          var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
          step((generator = generator.apply(__this, __arguments)).next());
        });
      };
      let onmessage;
      let globalThis = {};
      for (let o = self; o; o = Object.getPrototypeOf(o))
        for (let k of Object.getOwnPropertyNames(o))
          if (!(k in globalThis))
            Object.defineProperty(globalThis, k, { get: () => self[k] });
      "use strict";
      (() => {
        const enosys = () => {
          const err = new Error("not implemented");
          err.code = "ENOSYS";
          return err;
        };
        if (!globalThis.fs) {
          let outputBuf = "";
          globalThis.fs = {
            constants: { O_WRONLY: -1, O_RDWR: -1, O_CREAT: -1, O_TRUNC: -1, O_APPEND: -1, O_EXCL: -1, O_DIRECTORY: -1 },
            // unused
            writeSync(fd, buf) {
              outputBuf += decoder.decode(buf);
              const nl = outputBuf.lastIndexOf("\\n");
              if (nl != -1) {
                console.log(outputBuf.substring(0, nl));
                outputBuf = outputBuf.substring(nl + 1);
              }
              return buf.length;
            },
            write(fd, buf, offset, length, position, callback) {
              if (offset !== 0 || length !== buf.length || position !== null) {
                callback(enosys());
                return;
              }
              const n = this.writeSync(fd, buf);
              callback(null, n);
            },
            chmod(path, mode, callback) {
              callback(enosys());
            },
            chown(path, uid, gid, callback) {
              callback(enosys());
            },
            close(fd, callback) {
              callback(enosys());
            },
            fchmod(fd, mode, callback) {
              callback(enosys());
            },
            fchown(fd, uid, gid, callback) {
              callback(enosys());
            },
            fstat(fd, callback) {
              callback(enosys());
            },
            fsync(fd, callback) {
              callback(null);
            },
            ftruncate(fd, length, callback) {
              callback(enosys());
            },
            lchown(path, uid, gid, callback) {
              callback(enosys());
            },
            link(path, link, callback) {
              callback(enosys());
            },
            lstat(path, callback) {
              callback(enosys());
            },
            mkdir(path, perm, callback) {
              callback(enosys());
            },
            open(path, flags, mode, callback) {
              callback(enosys());
            },
            read(fd, buffer, offset, length, position, callback) {
              callback(enosys());
            },
            readdir(path, callback) {
              callback(enosys());
            },
            readlink(path, callback) {
              callback(enosys());
            },
            rename(from, to, callback) {
              callback(enosys());
            },
            rmdir(path, callback) {
              callback(enosys());
            },
            stat(path, callback) {
              callback(enosys());
            },
            symlink(path, link, callback) {
              callback(enosys());
            },
            truncate(path, length, callback) {
              callback(enosys());
            },
            unlink(path, callback) {
              callback(enosys());
            },
            utimes(path, atime, mtime, callback) {
              callback(enosys());
            }
          };
        }
        if (!globalThis.process) {
          globalThis.process = {
            getuid() {
              return -1;
            },
            getgid() {
              return -1;
            },
            geteuid() {
              return -1;
            },
            getegid() {
              return -1;
            },
            getgroups() {
              throw enosys();
            },
            pid: -1,
            ppid: -1,
            umask() {
              throw enosys();
            },
            cwd() {
              throw enosys();
            },
            chdir() {
              throw enosys();
            }
          };
        }
        if (!globalThis.path) {
          globalThis.path = {
            resolve(...pathSegments) {
              return pathSegments.join("/");
            }
          };
        }
        if (!globalThis.crypto) {
          throw new Error("globalThis.crypto is not available, polyfill required (crypto.getRandomValues only)");
        }
        if (!globalThis.performance) {
          throw new Error("globalThis.performance is not available, polyfill required (performance.now only)");
        }
        if (!globalThis.TextEncoder) {
          throw new Error("globalThis.TextEncoder is not available, polyfill required");
        }
        if (!globalThis.TextDecoder) {
          throw new Error("globalThis.TextDecoder is not available, polyfill required");
        }
        const encoder = new TextEncoder("utf-8");
        const decoder = new TextDecoder("utf-8");
        globalThis.Go = class {
          constructor() {
            this.argv = ["js"];
            this.env = {};
            this.exit = (code) => {
              if (code !== 0) {
                console.warn("exit code:", code);
              }
            };
            this._exitPromise = new Promise((resolve) => {
              this._resolveExitPromise = resolve;
            });
            this._pendingEvent = null;
            this._scheduledTimeouts = /* @__PURE__ */ new Map();
            this._nextCallbackTimeoutID = 1;
            const setInt64 = (addr, v) => {
              this.mem.setUint32(addr + 0, v, true);
              this.mem.setUint32(addr + 4, Math.floor(v / 4294967296), true);
            };
            const setInt32 = (addr, v) => {
              this.mem.setUint32(addr + 0, v, true);
            };
            const getInt64 = (addr) => {
              const low = this.mem.getUint32(addr + 0, true);
              const high = this.mem.getInt32(addr + 4, true);
              return low + high * 4294967296;
            };
            const loadValue = (addr) => {
              const f = this.mem.getFloat64(addr, true);
              if (f === 0) {
                return void 0;
              }
              if (!isNaN(f)) {
                return f;
              }
              const id = this.mem.getUint32(addr, true);
              return this._values[id];
            };
            const storeValue = (addr, v) => {
              const nanHead = 2146959360;
              if (typeof v === "number" && v !== 0) {
                if (isNaN(v)) {
                  this.mem.setUint32(addr + 4, nanHead, true);
                  this.mem.setUint32(addr, 0, true);
                  return;
                }
                this.mem.setFloat64(addr, v, true);
                return;
              }
              if (v === void 0) {
                this.mem.setFloat64(addr, 0, true);
                return;
              }
              let id = this._ids.get(v);
              if (id === void 0) {
                id = this._idPool.pop();
                if (id === void 0) {
                  id = this._values.length;
                }
                this._values[id] = v;
                this._goRefCounts[id] = 0;
                this._ids.set(v, id);
              }
              this._goRefCounts[id]++;
              let typeFlag = 0;
              switch (typeof v) {
                case "object":
                  if (v !== null) {
                    typeFlag = 1;
                  }
                  break;
                case "string":
                  typeFlag = 2;
                  break;
                case "symbol":
                  typeFlag = 3;
                  break;
                case "function":
                  typeFlag = 4;
                  break;
              }
              this.mem.setUint32(addr + 4, nanHead | typeFlag, true);
              this.mem.setUint32(addr, id, true);
            };
            const loadSlice = (addr) => {
              const array = getInt64(addr + 0);
              const len = getInt64(addr + 8);
              return new Uint8Array(this._inst.exports.mem.buffer, array, len);
            };
            const loadSliceOfValues = (addr) => {
              const array = getInt64(addr + 0);
              const len = getInt64(addr + 8);
              const a = new Array(len);
              for (let i = 0; i < len; i++) {
                a[i] = loadValue(array + i * 8);
              }
              return a;
            };
            const loadString = (addr) => {
              const saddr = getInt64(addr + 0);
              const len = getInt64(addr + 8);
              return decoder.decode(new DataView(this._inst.exports.mem.buffer, saddr, len));
            };
            const testCallExport = (a, b) => {
              this._inst.exports.testExport0();
              return this._inst.exports.testExport(a, b);
            };
            const timeOrigin = Date.now() - performance.now();
            this.importObject = {
              _gotest: {
                add: (a, b) => a + b,
                callExport: testCallExport
              },
              gojs: {
                // Go's SP does not change as long as no Go code is running. Some operations (e.g. calls, getters and setters)
                // may synchronously trigger a Go event handler. This makes Go code get executed in the middle of the imported
                // function. A goroutine can switch to a new stack if the current stack is too small (see morestack function).
                // This changes the SP, thus we have to update the SP used by the imported function.
                // func wasmExit(code int32)
                "runtime.wasmExit": (sp) => {
                  sp >>>= 0;
                  const code = this.mem.getInt32(sp + 8, true);
                  this.exited = true;
                  delete this._inst;
                  delete this._values;
                  delete this._goRefCounts;
                  delete this._ids;
                  delete this._idPool;
                  this.exit(code);
                },
                // func wasmWrite(fd uintptr, p unsafe.Pointer, n int32)
                "runtime.wasmWrite": (sp) => {
                  sp >>>= 0;
                  const fd = getInt64(sp + 8);
                  const p = getInt64(sp + 16);
                  const n = this.mem.getInt32(sp + 24, true);
                  globalThis.fs.writeSync(fd, new Uint8Array(this._inst.exports.mem.buffer, p, n));
                },
                // func resetMemoryDataView()
                "runtime.resetMemoryDataView": (sp) => {
                  sp >>>= 0;
                  this.mem = new DataView(this._inst.exports.mem.buffer);
                },
                // func nanotime1() int64
                "runtime.nanotime1": (sp) => {
                  sp >>>= 0;
                  setInt64(sp + 8, (timeOrigin + performance.now()) * 1e6);
                },
                // func walltime() (sec int64, nsec int32)
                "runtime.walltime": (sp) => {
                  sp >>>= 0;
                  const msec = (/* @__PURE__ */ new Date()).getTime();
                  setInt64(sp + 8, msec / 1e3);
                  this.mem.setInt32(sp + 16, msec % 1e3 * 1e6, true);
                },
                // func scheduleTimeoutEvent(delay int64) int32
                "runtime.scheduleTimeoutEvent": (sp) => {
                  sp >>>= 0;
                  const id = this._nextCallbackTimeoutID;
                  this._nextCallbackTimeoutID++;
                  this._scheduledTimeouts.set(id, setTimeout(
                    () => {
                      this._resume();
                      while (this._scheduledTimeouts.has(id)) {
                        console.warn("scheduleTimeoutEvent: missed timeout event");
                        this._resume();
                      }
                    },
                    getInt64(sp + 8)
                  ));
                  this.mem.setInt32(sp + 16, id, true);
                },
                // func clearTimeoutEvent(id int32)
                "runtime.clearTimeoutEvent": (sp) => {
                  sp >>>= 0;
                  const id = this.mem.getInt32(sp + 8, true);
                  clearTimeout(this._scheduledTimeouts.get(id));
                  this._scheduledTimeouts.delete(id);
                },
                // func getRandomData(r []byte)
                "runtime.getRandomData": (sp) => {
                  sp >>>= 0;
                  crypto.getRandomValues(loadSlice(sp + 8));
                },
                // func finalizeRef(v ref)
                "syscall/js.finalizeRef": (sp) => {
                  sp >>>= 0;
                  const id = this.mem.getUint32(sp + 8, true);
                  this._goRefCounts[id]--;
                  if (this._goRefCounts[id] === 0) {
                    const v = this._values[id];
                    this._values[id] = null;
                    this._ids.delete(v);
                    this._idPool.push(id);
                  }
                },
                // func stringVal(value string) ref
                "syscall/js.stringVal": (sp) => {
                  sp >>>= 0;
                  storeValue(sp + 24, loadString(sp + 8));
                },
                // func valueGet(v ref, p string) ref
                "syscall/js.valueGet": (sp) => {
                  sp >>>= 0;
                  const result = Reflect.get(loadValue(sp + 8), loadString(sp + 16));
                  sp = this._inst.exports.getsp() >>> 0;
                  storeValue(sp + 32, result);
                },
                // func valueSet(v ref, p string, x ref)
                "syscall/js.valueSet": (sp) => {
                  sp >>>= 0;
                  Reflect.set(loadValue(sp + 8), loadString(sp + 16), loadValue(sp + 32));
                },
                // func valueDelete(v ref, p string)
                "syscall/js.valueDelete": (sp) => {
                  sp >>>= 0;
                  Reflect.deleteProperty(loadValue(sp + 8), loadString(sp + 16));
                },
                // func valueIndex(v ref, i int) ref
                "syscall/js.valueIndex": (sp) => {
                  sp >>>= 0;
                  storeValue(sp + 24, Reflect.get(loadValue(sp + 8), getInt64(sp + 16)));
                },
                // valueSetIndex(v ref, i int, x ref)
                "syscall/js.valueSetIndex": (sp) => {
                  sp >>>= 0;
                  Reflect.set(loadValue(sp + 8), getInt64(sp + 16), loadValue(sp + 24));
                },
                // func valueCall(v ref, m string, args []ref) (ref, bool)
                "syscall/js.valueCall": (sp) => {
                  sp >>>= 0;
                  try {
                    const v = loadValue(sp + 8);
                    const m = Reflect.get(v, loadString(sp + 16));
                    const args = loadSliceOfValues(sp + 32);
                    const result = Reflect.apply(m, v, args);
                    sp = this._inst.exports.getsp() >>> 0;
                    storeValue(sp + 56, result);
                    this.mem.setUint8(sp + 64, 1);
                  } catch (err) {
                    sp = this._inst.exports.getsp() >>> 0;
                    storeValue(sp + 56, err);
                    this.mem.setUint8(sp + 64, 0);
                  }
                },
                // func valueInvoke(v ref, args []ref) (ref, bool)
                "syscall/js.valueInvoke": (sp) => {
                  sp >>>= 0;
                  try {
                    const v = loadValue(sp + 8);
                    const args = loadSliceOfValues(sp + 16);
                    const result = Reflect.apply(v, void 0, args);
                    sp = this._inst.exports.getsp() >>> 0;
                    storeValue(sp + 40, result);
                    this.mem.setUint8(sp + 48, 1);
                  } catch (err) {
                    sp = this._inst.exports.getsp() >>> 0;
                    storeValue(sp + 40, err);
                    this.mem.setUint8(sp + 48, 0);
                  }
                },
                // func valueNew(v ref, args []ref) (ref, bool)
                "syscall/js.valueNew": (sp) => {
                  sp >>>= 0;
                  try {
                    const v = loadValue(sp + 8);
                    const args = loadSliceOfValues(sp + 16);
                    const result = Reflect.construct(v, args);
                    sp = this._inst.exports.getsp() >>> 0;
                    storeValue(sp + 40, result);
                    this.mem.setUint8(sp + 48, 1);
                  } catch (err) {
                    sp = this._inst.exports.getsp() >>> 0;
                    storeValue(sp + 40, err);
                    this.mem.setUint8(sp + 48, 0);
                  }
                },
                // func valueLength(v ref) int
                "syscall/js.valueLength": (sp) => {
                  sp >>>= 0;
                  setInt64(sp + 16, parseInt(loadValue(sp + 8).length));
                },
                // valuePrepareString(v ref) (ref, int)
                "syscall/js.valuePrepareString": (sp) => {
                  sp >>>= 0;
                  const str = encoder.encode(String(loadValue(sp + 8)));
                  storeValue(sp + 16, str);
                  setInt64(sp + 24, str.length);
                },
                // valueLoadString(v ref, b []byte)
                "syscall/js.valueLoadString": (sp) => {
                  sp >>>= 0;
                  const str = loadValue(sp + 8);
                  loadSlice(sp + 16).set(str);
                },
                // func valueInstanceOf(v ref, t ref) bool
                "syscall/js.valueInstanceOf": (sp) => {
                  sp >>>= 0;
                  this.mem.setUint8(sp + 24, loadValue(sp + 8) instanceof loadValue(sp + 16) ? 1 : 0);
                },
                // func copyBytesToGo(dst []byte, src ref) (int, bool)
                "syscall/js.copyBytesToGo": (sp) => {
                  sp >>>= 0;
                  const dst = loadSlice(sp + 8);
                  const src = loadValue(sp + 32);
                  if (!(src instanceof Uint8Array || src instanceof Uint8ClampedArray)) {
                    this.mem.setUint8(sp + 48, 0);
                    return;
                  }
                  const toCopy = src.subarray(0, dst.length);
                  dst.set(toCopy);
                  setInt64(sp + 40, toCopy.length);
                  this.mem.setUint8(sp + 48, 1);
                },
                // func copyBytesToJS(dst ref, src []byte) (int, bool)
                "syscall/js.copyBytesToJS": (sp) => {
                  sp >>>= 0;
                  const dst = loadValue(sp + 8);
                  const src = loadSlice(sp + 16);
                  if (!(dst instanceof Uint8Array || dst instanceof Uint8ClampedArray)) {
                    this.mem.setUint8(sp + 48, 0);
                    return;
                  }
                  const toCopy = src.subarray(0, dst.length);
                  dst.set(toCopy);
                  setInt64(sp + 40, toCopy.length);
                  this.mem.setUint8(sp + 48, 1);
                },
                "debug": (value) => {
                  console.log(value);
                }
              }
            };
          }
          run(instance) {
            return __async(this, null, function* () {
              if (!(instance instanceof WebAssembly.Instance)) {
                throw new Error("Go.run: WebAssembly.Instance expected");
              }
              this._inst = instance;
              this.mem = new DataView(this._inst.exports.mem.buffer);
              this._values = [
                // JS values that Go currently has references to, indexed by reference id
                NaN,
                0,
                null,
                true,
                false,
                globalThis,
                this
              ];
              this._goRefCounts = new Array(this._values.length).fill(Infinity);
              this._ids = /* @__PURE__ */ new Map([
                // mapping from JS values to reference ids
                [0, 1],
                [null, 2],
                [true, 3],
                [false, 4],
                [globalThis, 5],
                [this, 6]
              ]);
              this._idPool = [];
              this.exited = false;
              let offset = 4096;
              const strPtr = (str) => {
                const ptr = offset;
                const bytes = encoder.encode(str + "\\0");
                new Uint8Array(this.mem.buffer, offset, bytes.length).set(bytes);
                offset += bytes.length;
                if (offset % 8 !== 0) {
                  offset += 8 - offset % 8;
                }
                return ptr;
              };
              const argc = this.argv.length;
              const argvPtrs = [];
              this.argv.forEach((arg) => {
                argvPtrs.push(strPtr(arg));
              });
              argvPtrs.push(0);
              const keys = Object.keys(this.env).sort();
              keys.forEach((key) => {
                argvPtrs.push(strPtr(\`\${key}=\${this.env[key]}\`));
              });
              argvPtrs.push(0);
              const argv = offset;
              argvPtrs.forEach((ptr) => {
                this.mem.setUint32(offset, ptr, true);
                this.mem.setUint32(offset + 4, 0, true);
                offset += 8;
              });
              const wasmMinDataAddr = 4096 + 8192;
              if (offset >= wasmMinDataAddr) {
                throw new Error("total length of command line and environment variables exceeds limit");
              }
              this._inst.exports.run(argc, argv);
              if (this.exited) {
                this._resolveExitPromise();
              }
              yield this._exitPromise;
            });
          }
          _resume() {
            if (this.exited) {
              throw new Error("Go program has already exited");
            }
            this._inst.exports.resume();
            if (this.exited) {
              this._resolveExitPromise();
            }
          }
          _makeFuncWrapper(id) {
            const go = this;
            return function() {
              const event = { id, this: this, args: arguments };
              go._pendingEvent = event;
              go._resume();
              return event.result;
            };
          }
        };
      })();
      onmessage = ({ data: wasm }) => {
        let decoder = new TextDecoder();
        let fs = globalThis.fs;
        let stderr = "";
        fs.writeSync = (fd, buffer) => {
          if (fd === 1) {
            postMessage(buffer);
          } else if (fd === 2) {
            stderr += decoder.decode(buffer);
            let parts = stderr.split("\\n");
            if (parts.length > 1) console.log(parts.slice(0, -1).join("\\n"));
            stderr = parts[parts.length - 1];
          } else {
            throw new Error("Bad write");
          }
          return buffer.length;
        };
        let stdin = [];
        let resumeStdin;
        let stdinPos = 0;
        onmessage = ({ data }) => {
          if (data.length > 0) {
            stdin.push(data);
            if (resumeStdin) resumeStdin();
          }
          return go;
        };
        fs.read = (fd, buffer, offset, length, position, callback) => {
          if (fd !== 0 || offset !== 0 || length !== buffer.length || position !== null) {
            throw new Error("Bad read");
          }
          if (stdin.length === 0) {
            resumeStdin = () => fs.read(fd, buffer, offset, length, position, callback);
            return;
          }
          let first = stdin[0];
          let count = Math.max(0, Math.min(length, first.length - stdinPos));
          buffer.set(first.subarray(stdinPos, stdinPos + count), offset);
          stdinPos += count;
          if (stdinPos === first.length) {
            stdin.shift();
            stdinPos = 0;
          }
          callback(null, count);
        };
        let go = new globalThis.Go();
        go.argv = ["", \`--service=\${"0.27.7"}\`];
        tryToInstantiateModule(wasm, go).then(
          (instance) => {
            postMessage(null);
            go.run(instance);
          },
          (error) => {
            postMessage(error);
          }
        );
        return go;
      };
      function tryToInstantiateModule(wasm, go) {
        return __async(this, null, function* () {
          if (wasm instanceof WebAssembly.Module) {
            return WebAssembly.instantiate(wasm, go.importObject);
          }
          const res = yield fetch(wasm);
          if (!res.ok) throw new Error(\`Failed to download \${JSON.stringify(wasm)}\`);
          if ("instantiateStreaming" in WebAssembly && /^application\\/wasm($|;)/i.test(res.headers.get("Content-Type") || "")) {
            const result2 = yield WebAssembly.instantiateStreaming(res, go.importObject);
            return result2.instance;
          }
          const bytes = yield res.arrayBuffer();
          const result = yield WebAssembly.instantiate(bytes, go.importObject);
          return result.instance;
        });
      }
      return (m) => onmessage(m);
    })(postMessage)`],{type:"text/javascript"});u=new Worker(URL.createObjectURL(e))}else{let e,t=(e=>{let t;var r=(e,t,r)=>new Promise((s,n)=>{var i=e=>{try{o(r.next(e))}catch(e){n(e)}},l=e=>{try{o(r.throw(e))}catch(e){n(e)}},o=e=>e.done?s(e.value):Promise.resolve(e.value).then(i,l);o((r=r.apply(e,t)).next())});let s={};for(let e=self;e;e=Object.getPrototypeOf(e))for(let t of Object.getOwnPropertyNames(e))t in s||Object.defineProperty(s,t,{get:()=>self[t]});let n=()=>{let e=Error("not implemented");return e.code="ENOSYS",e};if(!s.fs){let e="";s.fs={constants:{O_WRONLY:-1,O_RDWR:-1,O_CREAT:-1,O_TRUNC:-1,O_APPEND:-1,O_EXCL:-1,O_DIRECTORY:-1},writeSync(t,r){let s=(e+=l.decode(r)).lastIndexOf("\n");return -1!=s&&(console.log(e.substring(0,s)),e=e.substring(s+1)),r.length},write(e,t,r,s,i,l){0!==r||s!==t.length||null!==i?l(n()):l(null,this.writeSync(e,t))},chmod(e,t,r){r(n())},chown(e,t,r,s){s(n())},close(e,t){t(n())},fchmod(e,t,r){r(n())},fchown(e,t,r,s){s(n())},fstat(e,t){t(n())},fsync(e,t){t(null)},ftruncate(e,t,r){r(n())},lchown(e,t,r,s){s(n())},link(e,t,r){r(n())},lstat(e,t){t(n())},mkdir(e,t,r){r(n())},open(e,t,r,s){s(n())},read(e,t,r,s,i,l){l(n())},readdir(e,t){t(n())},readlink(e,t){t(n())},rename(e,t,r){r(n())},rmdir(e,t){t(n())},stat(e,t){t(n())},symlink(e,t,r){r(n())},truncate(e,t,r){r(n())},unlink(e,t){t(n())},utimes(e,t,r,s){s(n())}}}if(s.process||(s.process={getuid:()=>-1,getgid:()=>-1,geteuid:()=>-1,getegid:()=>-1,getgroups(){throw n()},pid:-1,ppid:-1,umask(){throw n()},cwd(){throw n()},chdir(){throw n()}}),s.path||(s.path={resolve:(...e)=>e.join("/")}),!s.crypto)throw Error("globalThis.crypto is not available, polyfill required (crypto.getRandomValues only)");if(!s.performance)throw Error("globalThis.performance is not available, polyfill required (performance.now only)");if(!s.TextEncoder)throw Error("globalThis.TextEncoder is not available, polyfill required");if(!s.TextDecoder)throw Error("globalThis.TextDecoder is not available, polyfill required");let i=new TextEncoder("utf-8"),l=new TextDecoder("utf-8");return s.Go=class{constructor(){this.argv=["js"],this.env={},this.exit=e=>{0!==e&&console.warn("exit code:",e)},this._exitPromise=new Promise(e=>{this._resolveExitPromise=e}),this._pendingEvent=null,this._scheduledTimeouts=new Map,this._nextCallbackTimeoutID=1;const e=(e,t)=>{this.mem.setUint32(e+0,t,!0),this.mem.setUint32(e+4,Math.floor(t/0x100000000),!0)},t=e=>this.mem.getUint32(e+0,!0)+0x100000000*this.mem.getInt32(e+4,!0),r=e=>{let t=this.mem.getFloat64(e,!0);if(0===t)return;if(!isNaN(t))return t;let r=this.mem.getUint32(e,!0);return this._values[r]},n=(e,t)=>{if("number"==typeof t&&0!==t){if(isNaN(t)){this.mem.setUint32(e+4,0x7ff80000,!0),this.mem.setUint32(e,0,!0);return}this.mem.setFloat64(e,t,!0);return}if(void 0===t)return void this.mem.setFloat64(e,0,!0);let r=this._ids.get(t);void 0===r&&(void 0===(r=this._idPool.pop())&&(r=this._values.length),this._values[r]=t,this._goRefCounts[r]=0,this._ids.set(t,r)),this._goRefCounts[r]++;let s=0;switch(typeof t){case"object":null!==t&&(s=1);break;case"string":s=2;break;case"symbol":s=3;break;case"function":s=4}this.mem.setUint32(e+4,0x7ff80000|s,!0),this.mem.setUint32(e,r,!0)},o=e=>{let r=t(e+0),s=t(e+8);return new Uint8Array(this._inst.exports.mem.buffer,r,s)},a=e=>{let s=t(e+0),n=t(e+8),i=Array(n);for(let e=0;e<n;e++)i[e]=r(s+8*e);return i},u=e=>{let r=t(e+0),s=t(e+8);return l.decode(new DataView(this._inst.exports.mem.buffer,r,s))},c=(e,t)=>(this._inst.exports.testExport0(),this._inst.exports.testExport(e,t)),f=Date.now()-performance.now();this.importObject={_gotest:{add:(e,t)=>e+t,callExport:c},gojs:{"runtime.wasmExit":e=>{e>>>=0;let t=this.mem.getInt32(e+8,!0);this.exited=!0,delete this._inst,delete this._values,delete this._goRefCounts,delete this._ids,delete this._idPool,this.exit(t)},"runtime.wasmWrite":e=>{let r=t((e>>>=0)+8),n=t(e+16),i=this.mem.getInt32(e+24,!0);s.fs.writeSync(r,new Uint8Array(this._inst.exports.mem.buffer,n,i))},"runtime.resetMemoryDataView":e=>{this.mem=new DataView(this._inst.exports.mem.buffer)},"runtime.nanotime1":t=>{e((t>>>=0)+8,(f+performance.now())*1e6)},"runtime.walltime":t=>{t>>>=0;let r=new Date().getTime();e(t+8,r/1e3),this.mem.setInt32(t+16,r%1e3*1e6,!0)},"runtime.scheduleTimeoutEvent":e=>{e>>>=0;let r=this._nextCallbackTimeoutID;this._nextCallbackTimeoutID++,this._scheduledTimeouts.set(r,setTimeout(()=>{for(this._resume();this._scheduledTimeouts.has(r);)console.warn("scheduleTimeoutEvent: missed timeout event"),this._resume()},t(e+8))),this.mem.setInt32(e+16,r,!0)},"runtime.clearTimeoutEvent":e=>{e>>>=0;let t=this.mem.getInt32(e+8,!0);clearTimeout(this._scheduledTimeouts.get(t)),this._scheduledTimeouts.delete(t)},"runtime.getRandomData":e=>{e>>>=0,crypto.getRandomValues(o(e+8))},"syscall/js.finalizeRef":e=>{e>>>=0;let t=this.mem.getUint32(e+8,!0);if(this._goRefCounts[t]--,0===this._goRefCounts[t]){let e=this._values[t];this._values[t]=null,this._ids.delete(e),this._idPool.push(t)}},"syscall/js.stringVal":e=>{n((e>>>=0)+24,u(e+8))},"syscall/js.valueGet":e=>{let t=Reflect.get(r((e>>>=0)+8),u(e+16));n((e=this._inst.exports.getsp()>>>0)+32,t)},"syscall/js.valueSet":e=>{Reflect.set(r((e>>>=0)+8),u(e+16),r(e+32))},"syscall/js.valueDelete":e=>{Reflect.deleteProperty(r((e>>>=0)+8),u(e+16))},"syscall/js.valueIndex":e=>{n((e>>>=0)+24,Reflect.get(r(e+8),t(e+16)))},"syscall/js.valueSetIndex":e=>{Reflect.set(r((e>>>=0)+8),t(e+16),r(e+24))},"syscall/js.valueCall":e=>{e>>>=0;try{let t=r(e+8),s=Reflect.get(t,u(e+16)),i=a(e+32),l=Reflect.apply(s,t,i);e=this._inst.exports.getsp()>>>0,n(e+56,l),this.mem.setUint8(e+64,1)}catch(t){n((e=this._inst.exports.getsp()>>>0)+56,t),this.mem.setUint8(e+64,0)}},"syscall/js.valueInvoke":e=>{e>>>=0;try{let t=r(e+8),s=a(e+16),i=Reflect.apply(t,void 0,s);e=this._inst.exports.getsp()>>>0,n(e+40,i),this.mem.setUint8(e+48,1)}catch(t){n((e=this._inst.exports.getsp()>>>0)+40,t),this.mem.setUint8(e+48,0)}},"syscall/js.valueNew":e=>{e>>>=0;try{let t=r(e+8),s=a(e+16),i=Reflect.construct(t,s);e=this._inst.exports.getsp()>>>0,n(e+40,i),this.mem.setUint8(e+48,1)}catch(t){n((e=this._inst.exports.getsp()>>>0)+40,t),this.mem.setUint8(e+48,0)}},"syscall/js.valueLength":t=>{e((t>>>=0)+16,parseInt(r(t+8).length))},"syscall/js.valuePrepareString":t=>{t>>>=0;let s=i.encode(String(r(t+8)));n(t+16,s),e(t+24,s.length)},"syscall/js.valueLoadString":e=>{let t=r((e>>>=0)+8);o(e+16).set(t)},"syscall/js.valueInstanceOf":e=>{e>>>=0,this.mem.setUint8(e+24,+(r(e+8)instanceof r(e+16)))},"syscall/js.copyBytesToGo":t=>{let s=o((t>>>=0)+8),n=r(t+32);if(!(n instanceof Uint8Array||n instanceof Uint8ClampedArray))return void this.mem.setUint8(t+48,0);let i=n.subarray(0,s.length);s.set(i),e(t+40,i.length),this.mem.setUint8(t+48,1)},"syscall/js.copyBytesToJS":t=>{let s=r((t>>>=0)+8),n=o(t+16);if(!(s instanceof Uint8Array||s instanceof Uint8ClampedArray))return void this.mem.setUint8(t+48,0);let i=n.subarray(0,s.length);s.set(i),e(t+40,i.length),this.mem.setUint8(t+48,1)},debug:e=>{console.log(e)}}}}run(e){return r(this,null,function*(){if(!(e instanceof WebAssembly.Instance))throw Error("Go.run: WebAssembly.Instance expected");this._inst=e,this.mem=new DataView(this._inst.exports.mem.buffer),this._values=[NaN,0,null,!0,!1,s,this],this._goRefCounts=Array(this._values.length).fill(1/0),this._ids=new Map([[0,1],[null,2],[!0,3],[!1,4],[s,5],[this,6]]),this._idPool=[],this.exited=!1;let t=4096,r=e=>{let r=t,s=i.encode(e+"\0");return new Uint8Array(this.mem.buffer,t,s.length).set(s),(t+=s.length)%8!=0&&(t+=8-t%8),r},n=this.argv.length,l=[];this.argv.forEach(e=>{l.push(r(e))}),l.push(0),Object.keys(this.env).sort().forEach(e=>{l.push(r(`${e}=${this.env[e]}`))}),l.push(0);let o=t;if(l.forEach(e=>{this.mem.setUint32(t,e,!0),this.mem.setUint32(t+4,0,!0),t+=8}),t>=12288)throw Error("total length of command line and environment variables exceeds limit");this._inst.exports.run(n,o),this.exited&&this._resolveExitPromise(),yield this._exitPromise})}_resume(){if(this.exited)throw Error("Go program has already exited");this._inst.exports.resume(),this.exited&&this._resolveExitPromise()}_makeFuncWrapper(e){let t=this;return function(){let r={id:e,this:this,args:arguments};return t._pendingEvent=r,t._resume(),r.result}}},t=({data:n})=>{let i,l=new TextDecoder,o=s.fs,a="";o.writeSync=(t,r)=>{if(1===t)e(r);else if(2===t){let e=(a+=l.decode(r)).split("\n");e.length>1&&console.log(e.slice(0,-1).join("\n")),a=e[e.length-1]}else throw Error("Bad write");return r.length};let u=[],c=0;t=({data:e})=>(e.length>0&&(u.push(e),i&&i()),f),o.read=(e,t,r,s,n,l)=>{if(0!==e||0!==r||s!==t.length||null!==n)throw Error("Bad read");if(0===u.length){i=()=>o.read(e,t,r,s,n,l);return}let a=u[0],f=Math.max(0,Math.min(s,a.length-c));t.set(a.subarray(c,c+f),r),(c+=f)===a.length&&(u.shift(),c=0),l(null,f)};let f=new s.Go;return f.argv=["","--service=0.27.7"],(function(e,t){return r(this,null,function*(){if(e instanceof WebAssembly.Module)return WebAssembly.instantiate(e,t.importObject);let r=yield fetch(e);if(!r.ok)throw Error(`Failed to download ${JSON.stringify(e)}`);if("instantiateStreaming"in WebAssembly&&/^application\/wasm($|;)/i.test(r.headers.get("Content-Type")||""))return(yield WebAssembly.instantiateStreaming(r,t.importObject)).instance;let s=yield r.arrayBuffer();return(yield WebAssembly.instantiate(s,t.importObject)).instance})})(n,f).then(t=>{e(null),f.run(t)},t=>{e(t)}),f},e=>t(e)})(e=>u.onmessage({data:e}));u={onmessage:null,postMessage:r=>setTimeout(()=>{try{e=t({data:r})}catch(e){c(e)}}),terminate(){if(e)for(let t of e._scheduledTimeouts.values())clearTimeout(t)}}}let ef=new Promise((e,t)=>{f=e,p=t});u.onmessage=({data:e})=>{u.onmessage=({data:e})=>eh(e),e?p(e):f()},u.postMessage(s||new URL(e,location.href).toString());let{readFromStdout:eh,service:ed}=(a={writeToStdin(e){u.postMessage(e)},isSync:!1,hasFS:!1,esbuild:d},m={},v={didClose:!1,reason:""},N={},M=0,V=0,B=new Uint8Array(16384),Z=0,er=(e,t,r)=>{if(v.didClose)return r("The service is no longer running"+v.reason,null);let s=M++;N[s]=(t,s)=>{try{r(t,s)}finally{e&&e.unref()}},e&&e.ref(),a.writeToStdin(g({id:s,isRequest:!0,value:t}))},eo=(e,t)=>{if(v.didClose)throw Error("The service is no longer running"+v.reason);a.writeToStdin(g({id:e,isRequest:!1,value:t}))},ea=!0,eu=e=>{if(ea){ea=!1;let t=String.fromCharCode(...e);if("0.27.7"!==t)throw Error(`Cannot start service: Host version "0.27.7" does not match binary version ${k(t)}`);return}let t=function(e){let t=()=>{switch(s.read8()){case 0:return null;case 1:return!!s.read8();case 2:return s.read32();case 3:return r(s.read());case 4:return s.read();case 5:{let e=s.read32(),r=[];for(let s=0;s<e;s++)r.push(t());return r}case 6:{let e=s.read32(),n={};for(let i=0;i<e;i++)n[r(s.read())]=t();return n}default:throw Error("Invalid packet")}},s=new y(e),n=s.read32(),i=(1&n)==0;n>>>=1;let l=t();if(s.ptr!==e.length)throw Error("Invalid packet");return{id:n,isRequest:i,value:l}}(e);if(t.isRequest){let e,r;e=t.id,r=t.value,h(null,null,function*(){try{if("ping"===r.command)return void eo(e,{});if("number"==typeof r.key){let t=m[r.key];if(!t)return;let s=t[r.command];if(s)return void(yield s(e,r))}throw Error("Invalid command: "+r.command)}catch(r){let t=[Q(r,a,null,void 0,"")];try{eo(e,{errors:t})}catch(e){}}})}else{let e=N[t.id];delete N[t.id],t.value.error?e(t.value.error,{}):e(null,t.value)}},{readFromStdout:e=>{let t=Z+e.length;if(t>B.length){let e=new Uint8Array(2*t);e.set(B),B=e}B.set(e,Z),Z+=e.length;let r=0;for(;r+4<=Z;){let e=b(B,r);if(r+4+e>Z)break;r+=4,eu(B.subarray(r,r+e)),r+=e}r>0&&(B.copyWithin(0,r,Z),Z-=r)},afterClose:e=>{v.didClose=!0,e&&(v.reason=": "+(e.message||e));let t="The service was stopped"+v.reason;for(let e in N)N[e](t,null);N={}},service:{buildOrContext:({callName:e,refs:s,options:n,isTTY:i,defaultWD:l,callback:o})=>{let u=0,c=V++,f={},d={ref(){1==++u&&s&&s.ref()},unref(){0==--u&&(delete m[c],s&&s.unref())}};m[c]=f,d.ref(),function(e,s,n,i,l,o,a,u,c,f,d){let p,m=K(),g="context"===e,y=(e,t)=>{let r=[];try{J(r,u,{},c,E)}catch(e){}let s=Q(e,o,m,void 0,t);n(l,{command:"error",flags:r,error:s},()=>{s.detail=m.load(s.detail),d(ee(g?"Context failed":"Build failed",[s],[]),null)})};if("object"==typeof u){let e=u.plugins;if(void 0!==e){if(!Array.isArray(e))return y(Error('"plugins" must be an array'),"");p=e}}if(p&&p.length>0){let e,r,c,f,d,g,v,w,x;return o.isSync?y(Error("Cannot use plugins in synchronous API calls"),""):(e=s,r=n,c=i,f=l,d=o,g=a,v=u,w=p,x=m,h(null,null,function*(){let s=[],n=[],i={},l={},o=[],a=0,u=0,p=[],m=!1;for(let t of w=[...w]){let c={};if("object"!=typeof t)throw Error(`Plugin at index ${u} must be an object`);let h=G(t,c,"name",S);if("string"!=typeof h||""===h)throw Error(`Plugin at index ${u} is missing a name`);try{let g=G(t,c,"setup",A);if("function"!=typeof g)throw Error("Plugin is missing a setup function");q(t,c,`on plugin ${k(h)}`);let y={name:h,onStart:!1,onEnd:!1,onResolve:[],onLoad:[]};u++;let b=(t,s={})=>{if(!m)throw Error('Cannot call "resolve" before plugin setup has completed');if("string"!=typeof t)throw Error("The path to resolve must be a string");let n=Object.create(null),i=G(s,n,"pluginName",S),l=G(s,n,"importer",S),o=G(s,n,"namespace",S),a=G(s,n,"resolveDir",S),u=G(s,n,"kind",S),c=G(s,n,"pluginData",T),d=G(s,n,"with",R);return q(s,n,"in resolve() call"),new Promise((s,n)=>{let p={command:"resolve",path:t,key:e,pluginName:h};if(null!=i&&(p.pluginName=i),null!=l&&(p.importer=l),null!=o&&(p.namespace=o),null!=a&&(p.resolveDir=a),null!=u)p.kind=u;else throw Error('Must specify "kind" when calling "resolve"');null!=c&&(p.pluginData=x.store(c)),null!=d&&(p.with=function(e,t){let r=Object.create(null);for(let s in e){let n=e[s];if("string"!=typeof n)throw Error(`key ${k(s)} in object ${k(t)} must be a string`);r[s]=n}return r}(d,"with")),r(f,p,(e,t)=>{null!==e?n(Error(e)):s({errors:et(t.errors,x),warnings:et(t.warnings,x),path:t.path,external:t.external,sideEffects:t.sideEffects,namespace:t.namespace,suffix:t.suffix,pluginData:x.load(t.pluginData)})})})},w=g({initialOptions:v,resolve:b,onStart(e){let t=X(Error('This error came from the "onStart" callback registered here:'),d,"onStart");s.push({name:h,callback:e,note:t}),y.onStart=!0},onEnd(e){let t=X(Error('This error came from the "onEnd" callback registered here:'),d,"onEnd");n.push({name:h,callback:e,note:t}),y.onEnd=!0},onResolve(e,t){let r=X(Error('This error came from the "onResolve" callback registered here:'),d,"onResolve"),s={},n=G(e,s,"filter",P),l=G(e,s,"namespace",S);if(q(e,s,`in onResolve() call for plugin ${k(h)}`),null==n)throw Error("onResolve() call is missing a filter");let o=a++;i[o]={name:h,callback:t,note:r},y.onResolve.push({id:o,filter:el(n),namespace:l||""})},onLoad(e,t){let r=X(Error('This error came from the "onLoad" callback registered here:'),d,"onLoad"),s={},n=G(e,s,"filter",P),i=G(e,s,"namespace",S);if(q(e,s,`in onLoad() call for plugin ${k(h)}`),null==n)throw Error("onLoad() call is missing a filter");let o=a++;l[o]={name:h,callback:t,note:r},y.onLoad.push({id:o,filter:el(n),namespace:i||""})},onDispose(e){o.push(e)},esbuild:d.esbuild});w&&(yield w),p.push(y)}catch(e){return{ok:!1,error:e,pluginName:h}}}g["on-start"]=(e,t)=>h(null,null,function*(){x.clear();let t={errors:[],warnings:[]};yield Promise.all(s.map(e=>h(null,[e],function*({name:e,callback:r,note:s}){try{let s=yield r();if(null!=s){if("object"!=typeof s)throw Error(`Expected onStart() callback in plugin ${k(e)} to return an object`);let r={},n=G(s,r,"errors",I),i=G(s,r,"warnings",I);q(s,r,`from onStart() callback in plugin ${k(e)}`),null!=n&&t.errors.push(...es(n,"errors",x,e,void 0)),null!=i&&t.warnings.push(...es(i,"warnings",x,e,void 0))}}catch(r){t.errors.push(Q(r,d,x,s&&s(),e))}}))),c(e,t)}),g["on-resolve"]=(e,t)=>h(null,null,function*(){let r={},s="",n,l;for(let e of t.ids)try{({name:s,callback:n,note:l}=i[e]);let o=yield n({path:t.path,importer:t.importer,namespace:t.namespace,resolveDir:t.resolveDir,kind:t.kind,pluginData:x.load(t.pluginData),with:t.with});if(null!=o){if("object"!=typeof o)throw Error(`Expected onResolve() callback in plugin ${k(s)} to return an object`);let t={},n=G(o,t,"pluginName",S),i=G(o,t,"path",S),l=G(o,t,"namespace",S),a=G(o,t,"suffix",S),u=G(o,t,"external",j),c=G(o,t,"sideEffects",j),f=G(o,t,"pluginData",T),h=G(o,t,"errors",I),d=G(o,t,"warnings",I),p=G(o,t,"watchFiles",C),m=G(o,t,"watchDirs",C);q(o,t,`from onResolve() callback in plugin ${k(s)}`),r.id=e,null!=n&&(r.pluginName=n),null!=i&&(r.path=i),null!=l&&(r.namespace=l),null!=a&&(r.suffix=a),null!=u&&(r.external=u),null!=c&&(r.sideEffects=c),null!=f&&(r.pluginData=x.store(f)),null!=h&&(r.errors=es(h,"errors",x,s,void 0)),null!=d&&(r.warnings=es(d,"warnings",x,s,void 0)),null!=p&&(r.watchFiles=en(p,"watchFiles")),null!=m&&(r.watchDirs=en(m,"watchDirs"));break}}catch(t){r={id:e,errors:[Q(t,d,x,l&&l(),s)]};break}c(e,r)}),g["on-load"]=(e,r)=>h(null,null,function*(){let s={},n="",i,o;for(let e of r.ids)try{({name:n,callback:i,note:o}=l[e]);let a=yield i({path:r.path,namespace:r.namespace,suffix:r.suffix,pluginData:x.load(r.pluginData),with:r.with});if(null!=a){if("object"!=typeof a)throw Error(`Expected onLoad() callback in plugin ${k(n)} to return an object`);let r={},i=G(a,r,"pluginName",S),l=G(a,r,"contents",L),o=G(a,r,"resolveDir",S),u=G(a,r,"pluginData",T),c=G(a,r,"loader",S),f=G(a,r,"errors",I),h=G(a,r,"warnings",I),d=G(a,r,"watchFiles",C),p=G(a,r,"watchDirs",C);q(a,r,`from onLoad() callback in plugin ${k(n)}`),s.id=e,null!=i&&(s.pluginName=i),l instanceof Uint8Array?s.contents=l:null!=l&&(s.contents=t(l)),null!=o&&(s.resolveDir=o),null!=u&&(s.pluginData=x.store(u)),null!=c&&(s.loader=c),null!=f&&(s.errors=es(f,"errors",x,n,void 0)),null!=h&&(s.warnings=es(h,"warnings",x,n,void 0)),null!=d&&(s.watchFiles=en(d,"watchFiles")),null!=p&&(s.watchDirs=en(p,"watchDirs"));break}}catch(t){s={id:e,errors:[Q(t,d,x,o&&o(),n)]};break}c(e,s)});let y=(e,t)=>t([],[]);return n.length>0&&(y=(e,t)=>{h(null,null,function*(){let r=[],s=[];for(let{name:t,callback:i,note:l}of n){let n,o;try{let r=yield i(e);if(null!=r){if("object"!=typeof r)throw Error(`Expected onEnd() callback in plugin ${k(t)} to return an object`);let e={},s=G(r,e,"errors",I),i=G(r,e,"warnings",I);q(r,e,`from onEnd() callback in plugin ${k(t)}`),null!=s&&(n=es(s,"errors",x,t,void 0)),null!=i&&(o=es(i,"warnings",x,t,void 0))}}catch(e){n=[Q(e,d,x,l&&l(),t)]}if(n){r.push(...n);try{e.errors.push(...n)}catch(e){}}if(o){s.push(...o);try{e.warnings.push(...o)}catch(e){}}}t(r,s)})}),m=!0,{ok:!0,requestPlugins:p,runOnEndCallbacks:y,scheduleOnDisposeCallbacks:()=>{for(let e of o)setTimeout(()=>e(),0)}}})).then(e=>{if(!e.ok)return y(e.error,e.pluginName);try{b(e.requestPlugins,e.runOnEndCallbacks,e.scheduleOnDisposeCallbacks)}catch(e){y(e,"")}},e=>y(e,""))}try{b(null,(e,t)=>t([],[]),()=>{})}catch(e){y(e,"")}function b(h,p,y){let b,v,{entries:k,flags:_,write:T,stdinContents:P,stdinResolveDir:I,absWorkingDir:N,nodePaths:M,mangleCache:V}=function(e,r,s,n,i){var l;let o=[],a=[],u=Object.create(null),c=null,f=null;J(o,r,u,s,n),H(o,r,u);let h=G(r,u,"sourcemap",F),d=G(r,u,"bundle",j),p=G(r,u,"splitting",j),m=G(r,u,"preserveSymlinks",j),g=G(r,u,"metafile",j),y=G(r,u,"outfile",S),b=G(r,u,"outdir",S),v=G(r,u,"outbase",S),w=G(r,u,"tsconfig",S),x=G(r,u,"resolveExtensions",C),k=G(r,u,"nodePaths",C),E=G(r,u,"mainFields",C),_=G(r,u,"conditions",C),T=G(r,u,"external",C),P=G(r,u,"packages",S),O=G(r,u,"alias",R),U=G(r,u,"loader",R),A=G(r,u,"outExtension",R),I=G(r,u,"publicPath",S),N=G(r,u,"entryNames",S),M=G(r,u,"chunkNames",S),V=G(r,u,"assetNames",S),W=G(r,u,"inject",C),B=G(r,u,"banner",R),K=G(r,u,"footer",R),X=G(r,u,"entryPoints",D),Q=G(r,u,"absWorkingDir",S),Z=G(r,u,"stdin",R),ee=null!=(l=G(r,u,"write",j))?l:i,et=G(r,u,"allowOverwrite",j),er=G(r,u,"mangleCache",R);if(u.plugins=!0,q(r,u,`in ${e}() call`),h&&o.push(`--sourcemap${!0===h?"":`=${h}`}`),d&&o.push("--bundle"),et&&o.push("--allow-overwrite"),p&&o.push("--splitting"),m&&o.push("--preserve-symlinks"),g&&o.push("--metafile"),y&&o.push(`--outfile=${y}`),b&&o.push(`--outdir=${b}`),v&&o.push(`--outbase=${v}`),w&&o.push(`--tsconfig=${w}`),P&&o.push(`--packages=${P}`),x&&o.push(`--resolve-extensions=${$(x,"resolve extension")}`),I&&o.push(`--public-path=${I}`),N&&o.push(`--entry-names=${N}`),M&&o.push(`--chunk-names=${M}`),V&&o.push(`--asset-names=${V}`),E&&o.push(`--main-fields=${$(E,"main field")}`),_&&o.push(`--conditions=${$(_,"condition")}`),T)for(let e of T)o.push(`--external:${Y(e,"external")}`);if(O)for(let e in O){if(e.indexOf("=")>=0)throw Error(`Invalid package name in alias: ${e}`);o.push(`--alias:${e}=${Y(O[e],"alias",e)}`)}if(B)for(let e in B){if(e.indexOf("=")>=0)throw Error(`Invalid banner file type: ${e}`);o.push(`--banner:${e}=${Y(B[e],"banner",e)}`)}if(K)for(let e in K){if(e.indexOf("=")>=0)throw Error(`Invalid footer file type: ${e}`);o.push(`--footer:${e}=${Y(K[e],"footer",e)}`)}if(W)for(let e of W)o.push(`--inject:${Y(e,"inject")}`);if(U)for(let e in U){if(e.indexOf("=")>=0)throw Error(`Invalid loader extension: ${e}`);o.push(`--loader:${e}=${Y(U[e],"loader",e)}`)}if(A)for(let e in A){if(e.indexOf("=")>=0)throw Error(`Invalid out extension: ${e}`);o.push(`--out-extension:${e}=${Y(A[e],"out extension",e)}`)}if(X)if(Array.isArray(X))for(let e=0,t=X.length;e<t;e++){let t=X[e];if("object"==typeof t&&null!==t){let r=Object.create(null),s=G(t,r,"in",S),n=G(t,r,"out",S);if(q(t,r,"in entry point at index "+e),void 0===s)throw Error('Missing property "in" for entry point at index '+e);if(void 0===n)throw Error('Missing property "out" for entry point at index '+e);a.push([n,s])}else a.push(["",Y(t,"entry point at index "+e)])}else for(let e in X)a.push([e,Y(X[e],"entry point",e)]);if(Z){let e=Object.create(null),r=G(Z,e,"contents",L),s=G(Z,e,"resolveDir",S),n=G(Z,e,"sourcefile",S),i=G(Z,e,"loader",S);q(Z,e,'in "stdin" object'),n&&o.push(`--sourcefile=${n}`),i&&o.push(`--loader=${i}`),s&&(f=s),"string"==typeof r?c=t(r):r instanceof Uint8Array&&(c=r)}let es=[];if(k)for(let e of k)e+="",es.push(e);return{entries:a,flags:o,write:ee,stdinContents:c,stdinResolveDir:f,absWorkingDir:Q,nodePaths:es,mangleCache:z(er)}}(e,u,c,E,o.hasFS);if(T&&!o.hasFS)throw Error('The "write" option is unavailable in this environment');let B={command:"build",key:s,entries:k,flags:_,write:T,stdinContents:P,stdinResolveDir:I,absWorkingDir:N||f,nodePaths:M,context:g};h&&(B.plugins=h),V&&(B.mangleCache=V);let K=(e,t)=>{let s={errors:et(e.errors,m),warnings:et(e.warnings,m),outputFiles:void 0,metafile:void 0,mangleCache:void 0},n=s.errors.slice(),i=s.warnings.slice();e.outputFiles&&(s.outputFiles=e.outputFiles.map(ei)),e.metafile&&e.metafile.length&&(s.metafile=function(e){let t;try{t=r(e)}catch(t){return function(e){let t;if(!(e instanceof Uint8Array))throw Error("JSON input must be a Uint8Array");let r=[],s=[],n=[],i=e.length,l=null,o=0,a=0;for(;a<i;){let u,c=e[a++];if(!(c<=32)){switch(2===o&&null===l&&34!==c&&125!==c&&x(e,--a),c){case 116:(114!==e[a++]||117!==e[a++]||101!==e[a++])&&x(e,--a),u=!0;break;case 102:(97!==e[a++]||108!==e[a++]||115!==e[a++]||101!==e[a++])&&x(e,--a),u=!1;break;case 110:(117!==e[a++]||108!==e[a++]||108!==e[a++])&&x(e,--a),u=null;break;case 45:case 46:case 48:case 49:case 50:case 51:case 52:case 53:case 54:case 55:case 56:case 57:{let t=a;for(u=w(c),c=e[a];;){switch(c){case 43:case 45:case 46:case 48:case 49:case 50:case 51:case 52:case 53:case 54:case 55:case 56:case 57:case 101:case 69:u+=w(c),c=e[++a];continue}break}isNaN(u*=1)&&x(e,--t,"Invalid number");break}case 34:for(u="";a>=i&&x(e,i),34!==(c=e[a++]);)if(92===c)switch(e[a++]){case 34:u+='"';break;case 47:u+="/";break;case 92:u+="\\";break;case 98:u+="\b";break;case 102:u+="\f";break;case 110:u+="\n";break;case 114:u+="\r";break;case 116:u+="	";break;case 117:{let t=0;for(let r=0;r<4;r++)c=e[a++],t<<=4,c>=48&&c<=57?t|=c-48:c>=97&&c<=102?t|=c+-87:c>=65&&c<=70?t|=c+-55:x(e,--a);u+=w(t);break}default:x(e,--a)}else if(c<=127)u+=w(c);else if((224&c)==192)u+=w((31&c)<<6|63&e[a++]);else if((240&c)==224)u+=w((15&c)<<12|(63&e[a++])<<6|63&e[a++]);else if((248&c)==240){let t=(7&c)<<18|(63&e[a++])<<12|(63&e[a++])<<6|63&e[a++];t>65535&&(t-=65536,u+=w(t>>10&1023|55296),t=56320|1023&t),u+=w(t)}u[0];break;case 91:u=[],r.push(l),s.push(t),n.push(o),l=null,t=u,o=1;continue;case 123:u={},r.push(l),s.push(t),n.push(o),l=null,t=u,o=2;continue;case 93:1!==o&&x(e,--a),u=t,l=r.pop(),t=s.pop(),o=n.pop();break;case 125:2!==o&&x(e,--a),u=t,l=r.pop(),t=s.pop(),o=n.pop();break;default:x(e,--a)}for(c=e[a];c<=32;)c=e[++a];switch(o){case 0:if(a===i)return u;break;case 1:if(t.push(u),44===c){a++;continue}if(93===c)continue;break;case 2:if(null===l){if(l=u,58===c){a++;continue}}else{if(t[l]=u,l=null,44===c){a++;continue}if(125===c)continue}}break}}x(e,a)}(e)}return JSON.parse(t)}(e.metafile)),e.mangleCache&&(s.mangleCache=e.mangleCache),void 0!==e.writeToStdout&&console.log(r(e.writeToStdout).replace(/\n$/,"")),p(s,(e,r)=>{if(n.length>0||e.length>0)return t(ee("Build failed",n.concat(e),i.concat(r)),null,e,r);t(null,s,e,r)})};g&&(a["on-end"]=(e,t)=>new Promise(r=>{K(t,(t,s,n,l)=>{v&&v(t,s),b=void 0,v=void 0,i(e,{errors:n,warnings:l}),r()})})),n(l,B,(e,t)=>{if(e)return d(Error(e),null);if(!g)return K(t,(e,t)=>(y(),d(e,t)));if(t.errors.length>0)return d(ee("Context failed",t.errors,t.warnings),null);let r=!1;l.ref(),d(null,{rebuild:()=>(b||(b=new Promise((e,t)=>{let r;v=(s,n)=>{r||(r=()=>s?t(s):e(n))};let i=()=>{n(l,{command:"rebuild",key:s},(e,s)=>{e?t(Error(e)):r?r():i()})};i()})),b),watch:(e={})=>new Promise((t,r)=>{if(!o.hasFS)throw Error('Cannot use the "watch" API in this environment');let i={},a=G(e,i,"delay",O);q(e,i,"in watch() call");let u={command:"watch",key:s};a&&(u.delay=a),n(l,u,e=>{e?r(Error(e)):t(void 0)})}),serve:(e={})=>new Promise((t,r)=>{if(!o.hasFS)throw Error('Cannot use the "serve" API in this environment');let u={},c=G(e,u,"port",U),f=G(e,u,"host",S),h=G(e,u,"servedir",S),d=G(e,u,"keyfile",S),p=G(e,u,"certfile",S),m=G(e,u,"fallback",S),g=G(e,u,"cors",R),y=G(e,u,"onRequest",A);q(e,u,"in serve() call");let b={command:"serve",key:s,onRequest:!!y};if(void 0!==c&&(b.port=c),void 0!==f&&(b.host=f),void 0!==h&&(b.servedir=h),void 0!==d&&(b.keyfile=d),void 0!==p&&(b.certfile=p),void 0!==m&&(b.fallback=m),g){let e={},t=G(g,e,"origin",W);q(g,e,'on "cors" object'),Array.isArray(t)?b.corsOrigin=t:void 0!==t&&(b.corsOrigin=[t])}n(l,b,(e,s)=>{if(e)return r(Error(e));y&&(a["serve-request"]=(e,t)=>{y(t.args),i(e,{})}),t(s)})}),cancel:()=>new Promise(e=>{if(r)return e();n(l,{command:"cancel",key:s},()=>{e()})}),dispose:()=>new Promise(e=>{if(r)return e();r=!0,n(l,{command:"dispose",key:s},()=>{e(),y(),l.unref()})})})})}}(e,c,er,eo,d,a,f,n,i,l,(e,t)=>{try{o(e,t)}finally{d.unref()}})},transform:({callName:e,refs:r,input:s,options:n,isTTY:i,fs:l,callback:o})=>{let u=K(),c=c=>{try{let a,f,h,d,p,m,g,y;if("string"!=typeof s&&!(s instanceof Uint8Array))throw Error('The input to "transform" must be a string or a Uint8Array');let{flags:b,mangleCache:v}=(a=[],f=Object.create(null),J(a,n,f,i,_),H(a,n,f),h=G(n,f,"sourcemap",F),d=G(n,f,"sourcefile",S),p=G(n,f,"loader",S),m=G(n,f,"banner",S),g=G(n,f,"footer",S),y=G(n,f,"mangleCache",R),q(n,f,`in ${e}() call`),h&&a.push(`--sourcemap=${!0===h?"external":h}`),d&&a.push(`--sourcefile=${d}`),p&&a.push(`--loader=${p}`),m&&a.push(`--banner=${m}`),g&&a.push(`--footer=${g}`),{flags:a,mangleCache:z(y)}),w={command:"transform",flags:b,inputFS:null!==c,input:null!==c?t(c):"string"==typeof s?t(s):s};v&&(w.mangleCache=v),er(r,w,(e,t)=>{if(e)return o(Error(e),null);let r=et(t.errors,u),s=et(t.warnings,u),n=1,i=()=>{if(0==--n){let e={warnings:s,code:t.code,map:t.map,mangleCache:void 0,legalComments:void 0};"legalComments"in t&&(e.legalComments=null==t?void 0:t.legalComments),t.mangleCache&&(e.mangleCache=null==t?void 0:t.mangleCache),o(null,e)}};if(r.length>0)return o(ee("Transform failed",r,s),null);t.codeFS&&(n++,l.readFile(t.code,(e,r)=>{null!==e?o(e,null):(t.code=r,i())})),t.mapFS&&(n++,l.readFile(t.map,(e,r)=>{null!==e?o(e,null):(t.map=r,i())})),i()})}catch(s){let e=[];try{J(e,n,{},i,_)}catch(e){}let t=Q(s,a,u,void 0,"");er(r,{command:"error",flags:e,error:t},()=>{t.detail=u.load(t.detail),o(ee("Transform failed",[t],[]),null)})}};if(("string"==typeof s||s instanceof Uint8Array)&&s.length>1048576){let e=c;c=()=>l.writeFile(s,e)}c(null)},formatMessages:({callName:e,refs:t,messages:r,options:s,callback:n})=>{if(!s)throw Error(`Missing second argument in ${e}() call`);let i={},l=G(s,i,"kind",S),o=G(s,i,"color",j),a=G(s,i,"terminalWidth",O);if(q(s,i,`in ${e}() call`),void 0===l)throw Error(`Missing "kind" in ${e}() call`);if("error"!==l&&"warning"!==l)throw Error(`Expected "kind" to be "error" or "warning" in ${e}() call`);let u={command:"format-msgs",messages:es(r,"messages",null,"",a),isWarning:"warning"===l};void 0!==o&&(u.color=o),void 0!==a&&(u.terminalWidth=a),er(t,u,(e,t)=>{if(e)return n(Error(e),null);n(null,t.messages)})},analyzeMetafile:({callName:e,refs:t,metafile:r,options:s,callback:n})=>{void 0===s&&(s={});let i={},l=G(s,i,"color",j),o=G(s,i,"verbose",j);q(s,i,`in ${e}() call`);let a={command:"analyze-metafile",metafile:r};void 0!==l&&(a.color=l),void 0!==o&&(a.verbose=o),er(t,a,(e,t)=>{if(e)return n(Error(e),null);n(null,t.result)})}}});yield ef,l=()=>{u.terminate(),i=void 0,l=void 0,o=void 0},o={build:e=>new Promise((t,r)=>{ec.then(r),ed.buildOrContext({callName:"build",refs:null,options:e,isTTY:!1,defaultWD:"/",callback:(e,s)=>e?r(e):t(s)})}),context:e=>new Promise((t,r)=>{ec.then(r),ed.buildOrContext({callName:"context",refs:null,options:e,isTTY:!1,defaultWD:"/",callback:(e,s)=>e?r(e):t(s)})}),transform:(e,t)=>new Promise((r,s)=>{ec.then(s),ed.transform({callName:"transform",refs:null,input:e,options:t||{},isTTY:!1,fs:{readFile(e,t){t(Error("Internal error"),null)},writeFile(e,t){t(null)}},callback:(e,t)=>e?s(e):r(t)})}),formatMessages:(e,t)=>new Promise((r,s)=>{ec.then(s),ed.formatMessages({callName:"formatMessages",refs:null,messages:e,options:t,callback:(e,t)=>e?s(e):r(t)})}),analyzeMetafile:(e,t)=>new Promise((r,s)=>{ec.then(s),ed.analyzeMetafile({callName:"analyzeMetafile",refs:null,metafile:"string"==typeof e?e:JSON.stringify(e),options:t,callback:(e,t)=>e?s(e):r(t)})})}}),ex=d})(t)}]);
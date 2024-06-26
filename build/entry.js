

/* oak build --web */
// module system
const __Oak_Modules = {};
let __Oak_Import_Aliases;
function __oak_modularize(name, fn) {
	__Oak_Modules[name] = fn;
}
function __oak_module_import(name) {
	if (typeof __Oak_Modules[name] === 'object') return __Oak_Modules[name];
	const module = __Oak_Modules[name] || __Oak_Modules[__Oak_Import_Aliases[name]];
	if (module) {
		__Oak_Modules[name] = {}; // break circular imports
		return __Oak_Modules[name] = module();
	} else {
		throw new Error(`Could not import Oak module "${name}" at runtime`);
	}
}

// language primitives
let __oak_empty_assgn_tgt;
function __oak_eq(a, b) {
	if (a === __Oak_Empty || b === __Oak_Empty) return true;

	// match either null or undefined to compare correctly against undefined ?s
	// appearing in places like optional arguments
	if (a == null && b == null) return true;
	if (a == null || b == null) return false;

	// match all other types that can be compared cheaply (without function
	// calls for type coercion or recursive descent)
	if (typeof a === 'boolean' || typeof a === 'number' ||
		typeof a === 'symbol' || typeof a === 'function') {
		return a === b;
	}

	// string equality check
	a = __as_oak_string(a);
	b = __as_oak_string(b);
	if (typeof a !== typeof b) return false;
	if (__is_oak_string(a) && __is_oak_string(b)) {
		return a.valueOf() === b.valueOf();
	}

	// deep equality check for composite values
	if (len(a) !== len(b)) return false;
	for (const key of keys(a)) {
		if (!__oak_eq(a[key], b[key])) return false;
	}
	return true;
}
function __oak_acc(tgt, prop) {
	return (__is_oak_string(tgt) ? __as_oak_string(tgt.valueOf()[prop]) : tgt[prop]) ?? null;
}
function __oak_obj_key(x) {
	return typeof x === 'symbol' ? Symbol.keyFor(x) : x;
}
function __oak_push(a, b) {
	a = __as_oak_string(a);
	a.push(b);
	return a;
}
function __oak_and(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return a && b;
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) & get(b, i));
		}
		return res;
	}
	return a & b;
}
function __oak_or(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return a || b;
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) | get(b, i));
		}
		return res;
	}
	return a | b;
}
function __oak_xor(a, b) {
	if (typeof a === 'boolean' && typeof b === 'boolean') {
		return (a && !b) || (!a && b);
	}
	if (__is_oak_string(a) && __is_oak_string(b)) {
		const max = Math.max(a.length, b.length);
		const get = (s, i) => s.valueOf().charCodeAt(i) || 0;

		let res = '';
		for (let i = 0; i < max; i ++) {
			res += String.fromCharCode(get(a, i) ^ get(b, i));
		}
		return res;
	}
	return a ^ b;
}
const __Oak_Empty = Symbol('__Oak_Empty');

// mutable string type
function __is_oak_string(x) {
	if (x == null) return false;
	return x.__mark_oak_string;
}
function __as_oak_string(x) {
	if (typeof x === 'string') return __Oak_String(x);
	return x;
}
const __Oak_String = s => {
	return {
		__mark_oak_string: true,
		assign(i, slice) {
			if (i === s.length) return s += slice;
			return s = s.substr(0, i) + slice + s.substr(i + slice.length);
		},
		push(slice) {
			s += slice;
		},
		toString() {
			return s;
		},
		valueOf() {
			return s;
		},
		get length() {
			return s.length;
		},
	}
}

// tail recursion trampoline helpers
function __oak_resolve_trampoline(fn, ...args) {
	let rv = fn(...args);
	while (rv && rv.__is_oak_trampoline) {
		rv = rv.fn(...rv.args);
	}
	return rv;
}
function __oak_trampoline(fn, ...args) {
	return {
		__is_oak_trampoline: true,
		fn: fn,
		args: args,
	}
}

// env (builtin) functions

// reflection and types
const __Is_Oak_Node = typeof process === 'object';
const __Oak_Int_RE = /^[+-]?\d+$/;
function int(x) {
	x = __as_oak_string(x);
	if (typeof x === 'number') {
		// JS rounds towards higher magnitude, Oak rounds towards higher value
		const rounded = Math.floor(x);
		const diff = x - rounded;
		if (x < 0 && diff === 0.5) return rounded + 1;
		return rounded;
	}
	if (__is_oak_string(x) && __Oak_Int_RE.test(x.valueOf())) {
		const i = Number(x.valueOf());
		if (isNaN(i)) return null;
		return i;
	}
	return null;
}
function float(x) {
	x = __as_oak_string(x);
	if (typeof x === 'number') return x;
	if (__is_oak_string(x)) {
		const f = parseFloat(x.valueOf());
		if (isNaN(f)) return null;
		return f;
	}
	return null;
}
function atom(x) {
	x = __as_oak_string(x);
	if (typeof x === 'symbol' && x !== __Oak_Empty) return x;
	if (__is_oak_string(x)) return Symbol.for(x.valueOf());
	return Symbol.for(string(x));
}
function string(x) {
	x = __as_oak_string(x);
	function display(x) {
		x = __as_oak_string(x);
		if (__is_oak_string(x)) {
			return '\'' + x.valueOf().replace('\\', '\\\\').replace('\'', '\\\'') + '\'';
		} else if (typeof x === 'symbol') {
			if (x === __Oak_Empty) return '_';
			return ':' + Symbol.keyFor(x);
		}
		return string(x);
	}
	if (x == null) {
		return '?';
	} else if (typeof x === 'number') {
		return x.toString();
	} else if (__is_oak_string(x)) {
		return x;
	} else if (typeof x === 'boolean') {
		return x.toString();
	} else if (typeof x === 'function') {
		return x.toString();
	} else if (typeof x === 'symbol') {
		if (x === __Oak_Empty) return '_';
		return Symbol.keyFor(x);
	} else if (Array.isArray(x)) {
		return '[' + x.map(display).join(', ') + ']';
	} else if (typeof x === 'object') {
		const entries = [];
		for (const key of keys(x).sort()) {
			entries.push(`${key}: ${display(x[key])}`);
		}
		return '{' + entries.join(', ') + '}';
	}
	throw new Error('string() called on unknown type ' + x.toString());
}
function codepoint(c) {
	c = __as_oak_string(c);
	return c.valueOf().charCodeAt(0);
}
function char(n) {
	return String.fromCharCode(n);
}
function type(x) {
	x = __as_oak_string(x);
	if (x == null) {
		return Symbol.for('null');
	} else if (typeof x === 'number') {
		// Many discrete APIs check for :int, so we consider all integer
		// numbers :int and fall back to :float. This is not an airtight
		// solution, but works well enough and the alternative (tagged number
		// values/types) have poor perf tradeoffs.
		if (Number.isInteger(x)) return Symbol.for('int');
		return Symbol.for('float');
	} else if (__is_oak_string(x)) {
		return Symbol.for('string');
	} else if (typeof x === 'boolean') {
		return Symbol.for('bool');
	} else if (typeof x === 'symbol') {
		if (x === __Oak_Empty) return Symbol.for('empty');
		return Symbol.for('atom');
	} else if (typeof x === 'function') {
		return Symbol.for('function');
	} else if (Array.isArray(x)) {
		return Symbol.for('list');
	} else if (typeof x === 'object') {
		return Symbol.for('object');
	}
	throw new Error('type() called on unknown type ' + x.toString());
}
function len(x) {
	if (typeof x === 'string' || __is_oak_string(x) || Array.isArray(x)) {
		return x.length;
	} else if (typeof x === 'object' && x !== null) {
		return Object.getOwnPropertyNames(x).length;
	}
	throw new Error('len() takes a string or composite value, but got ' + string(x));
}
function keys(x) {
	if (Array.isArray(x)) {
		const k = [];
		for (let i = 0; i < x.length; i ++) k.push(i);
		return k;
	} else if (typeof x === 'object' && x !== null) {
		return Object.getOwnPropertyNames(x).map(__as_oak_string);
	}
	throw new Error('keys() takes a composite value, but got ' + string(x).valueOf());
}

// OS interfaces
function args() {
	if (__Is_Oak_Node) return process.argv.map(__as_oak_string);
	return [window.location.href];
}
function env() {
	if (__Is_Oak_Node) {
		const e = Object.assign({}, process.env);
		for (const key in e) {
			e[key] = __as_oak_string(e[key]);
		}
		return e;
	}
	return {};
}
function time() {
	return Date.now() / 1000;
}
function nanotime() {
	return int(Date.now() * 1000000);
}
function rand() {
	return Math.random();
}
let randomBytes;
function srand(length) {
	if (__Is_Oak_Node) {
		// lazily import dependency
		if (!randomBytes) randomBytes = require('crypto').randomBytes;
		return randomBytes(length).toString('latin1');
	}

	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return __as_oak_string(Array.from(bytes).map(b => String.fromCharCode(b)).join(''));
}
function wait(duration, cb) {
	setTimeout(cb, duration * 1000);
	return null;
}
function exit(code) {
	if (__Is_Oak_Node) process.exit(code);
	return null;
}
function exec() {
	throw new Error('exec() not implemented');
}

// I/O
function input() {
	throw new Error('input() not implemented');
}
function print(s) {
	s = __as_oak_string(s);
	if (__Is_Oak_Node) {
		process.stdout.write(string(s).toString());
	} else {
		console.log(string(s).toString());
	}
	return s.length;
}
function ls() {
	throw new Error('ls() not implemented');
}
function rm() {
	throw new Error('rm() not implemented');
}
function mkdir() {
	throw new Error('mkdir() not implemented');
}
function stat() {
	throw new Error('stat() not implemented');
}
function open() {
	throw new Error('open() not implemented');
}
function close() {
	throw new Error('close() not implemented');
}
function read() {
	throw new Error('read() not implemented');
}
function write() {
	throw new Error('write() not implemented');
}
function listen() {
	throw new Error('listen() not implemented');
}
function req() {
	throw new Error('req() not implemented');
}

// math
function sin(n) {
	return Math.sin(n);
}
function cos(n) {
	return Math.cos(n);
}
function tan(n) {
	return Math.tan(n);
}
function asin(n) {
	return Math.asin(n);
}
function acos(n) {
	return Math.acos(n);
}
function atan(n) {
	return Math.atan(n);
}
function pow(b, n) {
	return Math.pow(b, n);
}
function log(b, n) {
	return Math.log(n) / Math.log(b);
}

// runtime
function ___runtime_lib() {
	throw new Error('___runtime_lib() not implemented');
}
function ___runtime_lib__oak_qm() {
	throw new Error('___runtime_lib?() not implemented');
}
function ___runtime_gc() {
	throw new Error('___runtime_gc() not implemented');
}
function ___runtime_mem() {
	throw new Error('___runtime_mem() not implemented');
}

// JavaScript interop
function call(target, fn, ...args) {
	return target[Symbol.keyFor(fn)](...args);
}
function __oak_js_new(Constructor, ...args) {
	return new Constructor(...args);
}
function __oak_js_try(fn) {
	try {
		return {
			type: Symbol.for('ok'),
			ok: fn(),
		}
	} catch (e) {
		return {
			type: Symbol.for('error'),
			error: e,
		}
	}
}
(__oak_modularize(__Oak_String(`scenes/blocks/Transition.oak`),function _(){return ((Transition,std)=>((std=__oak_module_import(__Oak_String(`std`))),Transition=function Transition(color_=null,tw=null){return ((createFG,makeTransition,self)=>((color_=(std.__oak_js_default)(color_,BLACK)),(tw=(std.__oak_js_default)(tw,(easings.easeOutSine??null))),(self=({})),createFG=function createFG(){return (add([rect(width(),height()),color(0,0,0),opacity(1)]))},((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(tr,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.tr):(__oak_assgn_tgt.tr)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(self),createFG()),makeTransition=function makeTransition(speed=null,color=null){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(opacity,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.opacity):(__oak_assgn_tgt.opacity)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((self.tr??null)),0),((__oak_cond)=>__oak_eq(__oak_cond,true)?((self.tr??null).use)(color):null)(!__oak_eq(color,null)),((self.tr??null).use)(fadeIn(speed)))},((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(fadeIn,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.fadeIn):(__oak_assgn_tgt.fadeIn)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(self),function _(speed=null,color=null){return (makeTransition(speed,color))}),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(fadeOut,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.fadeOut):(__oak_assgn_tgt.fadeOut)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(self),function _(speed=null,color=null){return (((__oak_cond)=>__oak_eq(__oak_cond,true)?((self.tr??null).use)(color):null)(!__oak_eq(color,null)),((self.tr??null).fadeOut)(speed))}),self))()},({Transition,std})))()}),__oak_modularize(__Oak_String(`scenes/blocks/shakey.oak`),function _(){return ((shakey)=>(shakey=function shakey(obj=null){return ((STOP,draw_,off,ogp,on,returns,set,toggle)=>((ogp=(obj.pos??null)),(STOP=false),draw_=function draw_(){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?(((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(pos,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.pos):(__oak_assgn_tgt.pos)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(obj),((ogp.clone)().add)(rand(),rand()))):null)(!STOP)},(returns=(obj.onUpdate)(draw_)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(shakeyMod,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.shakeyMod):(__oak_assgn_tgt.shakeyMod)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(obj),({set:set=function set(v=null){return (STOP=v)},toggle:toggle=function toggle(){return set(!STOP)},on:on=function on(){return set(true)},off:off=function off(){return set(false)},returns,cancel:(returns.cancel??null),remove:function _(){return (off(),cancel())}})),returns))()},({shakey})))()}),__oak_modularize(__Oak_String(`scenes/init/main.oak`),function _(){return ((Transition,gwibble,spr)=>((gwibble=loadFont(s(__Oak_String(`gwibble`)),s(__Oak_String(`/fonts/gwibble/font.ttf`)))),(spr=OKloadSprite(__Oak_String(`bean`),__Oak_String(`/sprites/bean.png`))),({Transition}=__oak_module_import(__Oak_String(`scenes/blocks/Transition.oak`))),scene(__Oak_String(`game`),function _(){return ((bean)=>((bean=add([sprite(spr),pos(),area(),body(),opacity()]))))()}),({Transition,gwibble,spr})))()}),__oak_modularize(__Oak_String(`scenes/main.oak`),function _(){return ((bseq,init)=>((init=__oak_module_import(__Oak_String(`scenes/init/main.oak`))),(bseq=__oak_module_import(__Oak_String(`scenes/oc_bootseq/main.oak`))),go(__Oak_String(`init__`)),({bseq,init})))()}),__oak_modularize(__Oak_String(`scenes/notes/main.oak`),function _(){return ((ac,createGain,dest,getFreq,std)=>((std=__oak_module_import(__Oak_String(`std`))),(ac=audioCtx),(dest=(ac.destination??null)),getFreq=function getFreq(obj_=null){return ((Err,NOTES,note,octave)=>(({note,octave}=obj_),Err=function Err(e=null){return ({message:__Oak_String(`Missing value.`),error:e,type:Symbol.for('error')})},((__oak_cond)=>__oak_eq(__oak_cond,__oak_eq(note,null))?Err():__oak_eq(__oak_cond,__oak_eq(octave,null))?Err():null)(true),(NOTES=[__Oak_String(`C`),__Oak_String(`C#`),__Oak_String(`D`),__Oak_String(`D#`),__Oak_String(`E`),__Oak_String(`E#`),__Oak_String(`F`),__Oak_String(`F#`),__Oak_String(`G`),__Oak_String(`G#`),__Oak_String(`A`),__Oak_String(`A#`),__Oak_String(`B`),__Oak_String(`B#`)]),(440*pow(pow(2,(1/len(NOTES))),__as_oak_string(((octave*12))+(std.find)(NOTES,function _(ii=null){return (__oak_eq(ii,note))}))))))()},createGain=function createGain(){return ((createSquare,createTriangle,createWhiteNoise,gain)=>(({gain:(gain=(ac.createGain)()),begin:(gain.connect)(dest),createTriangle:createTriangle=function createTriangle(){return ((_osc,set)=>((_osc=(ac.createOscillator)()),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(type,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.type):(__oak_assgn_tgt.type)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(_osc),__Oak_String(`triangle`)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(value,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.value):(__oak_assgn_tgt.value)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((_osc.frequency??null)),440),(_osc.connect)(gain),({set:set=function set(a=null){return ((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(value,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.value):(__oak_assgn_tgt.value)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((_osc.frequency??null)),a)},osc:_osc,start:(_osc.start??null)})))()},createSquare:createSquare=function createSquare(){return ((_osc,set)=>((_osc=(ac.createOscillator)()),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(type,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.type):(__oak_assgn_tgt.type)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(_osc),__Oak_String(`square`)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(value,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.value):(__oak_assgn_tgt.value)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((_osc.frequency??null)),440),(_osc.connect)(gain),({set:set=function set(a=null){return ((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(value,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.value):(__oak_assgn_tgt.value)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((_osc.frequency??null)),a)},osc:_osc,start:(_osc.start??null)})))()},createWhiteNoise:createWhiteNoise=function createWhiteNoise(){return ((_buffer,_data,_source)=>((_buffer=(ac.createBuffer)(1,((ac.sampleRate??null)*2),(ac.sampleRate??null))),(_data=(_buffer.getChannelData)(0)),(std.each)(_data,function _(ii=null,i=null){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((i),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((i))]):(__oak_assgn_tgt[__oak_obj_key((i))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(_data),((rand()*2)-1)))}),(_source=(ac.createBufferSource)()),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(buffer,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.buffer):(__oak_assgn_tgt.buffer)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(_source),_buffer),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(loop,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.loop):(__oak_assgn_tgt.loop)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(_source),true),(_source.connect)(gain),({start:(_source.start??null),src:_source})))()}})))()},({ac,createGain,dest,getFreq,std})))()}),__oak_modularize(__Oak_String(`scenes/oc_bootseq/boot.oak`),function _(){return ((dt,gwibble,rnd,shakey,std)=>((std=__oak_module_import(__Oak_String(`std`))),(rnd=__oak_module_import(__Oak_String(`random`))),(dt=__oak_module_import(__Oak_String(`datetime`))),(gwibble=loadFont(s(__Oak_String(`gwibble`)),s(__Oak_String(`/fonts/gwibble/font.ttf`)))),({shakey}=__oak_module_import(__Oak_String(`scenes/blocks/shakey.oak`))),scene(__Oak_String(`init__`),function _(){return ((HIDE,SET,SHOW,TEXT,_ta,cn_title_text,name,names,track)=>(setBackground(WHITE),(names=[__Oak_String(`SpectCOW`),__Oak_String(`SpcFORK`),__Oak_String(`SpectMEOW`),__Oak_String(`Midialive`),__Oak_String(`Seedw`),__Oak_String(`Spcv`),__Oak_String(`Comercialcheck`),__Oak_String(`Bull ahh mf`)]),(name=(rnd.choice)(names)),(cn_title_text=add([text(s(name),({font:s(__Oak_String(`gwibble`)),size:48,width:300,align:s(__Oak_String(`center`))})),color(BLACK),pos(center()),anchor(s(__Oak_String(`center`)))])),SET=function SET(v=null){return ((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(opacity,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.opacity):(__oak_assgn_tgt.opacity)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(cn_title_text),v)},SHOW=function SHOW(){return SET(1)},HIDE=function HIDE(){return SET(0)},TEXT=function TEXT(v=null){return ((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(text,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.text):(__oak_assgn_tgt.text)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(cn_title_text),v)},shakey(cn_title_text),(track=0),_ta=function _ta(amm=null){return (track=__as_oak_string(track+amm))},wait(_ta(3),function _(){return (HIDE(),TEXT(((__oak_js_new(Date)).getFullYear)()))}),wait(_ta((3/2)),SHOW),wait(_ta(2),HIDE),wait(_ta((3/2)),function _(){return go(__Oak_String(`boot__`))})))()}),({dt,gwibble,rnd,shakey,std})))()}),__oak_modularize(__Oak_String(`scenes/oc_bootseq/main.oak`),function _(){return ((Transition,_b2,newCut,notes,oK_,shakey,std)=>(({Transition}=__oak_module_import(__Oak_String(`scenes/blocks/Transition.oak`))),(notes=__oak_module_import(__Oak_String(`scenes/notes/main.oak`))),(std=__oak_module_import(__Oak_String(`std`))),({newCut}=__oak_module_import(__Oak_String(`scenes/ware/cutscene.oak`))),({shakey}=__oak_module_import(__Oak_String(`scenes/blocks/shakey.oak`))),(oK_=OKloadSprite(__Oak_String(`oakcart`),__Oak_String(`/sprites/oakcart.png`))),(_b2=__oak_module_import(__Oak_String(`scenes/oc_bootseq/boot.oak`))),scene(__Oak_String(`boot__`),function _(){return ((CANCELLED__oak_qm,cutsc,cutsc_scale,logo_,setOpac)=>(setBackground(WHITE),(logo_=add([sprite(oK_,({width:200})),pos(center()),anchor(s(__Oak_String(`center`))),opacity(0)])),(CANCELLED__oak_qm=false),setOpac=function setOpac(opac=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(opacity,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.opacity):(__oak_assgn_tgt.opacity)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(logo_),opac):null)(!CANCELLED__oak_qm)},(cutsc=newCut()),(cutsc_scale=newCut()),((cutsc_scale.sh??null).step)(1),(cutsc_scale.Cutscene)([[0.05,0.7],[0.05,0.9],[0.05,1]],function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(scale,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.scale):(__oak_assgn_tgt.scale)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(logo_),i):null)(!CANCELLED__oak_qm)}),((cutsc.sh??null).step)(1),(cutsc.Cutscene)([[0.1,0.2],[0.1,0.7],[0.1,1],[3,0.6],[0.5,0.3],[0.5,0.15],[0.5,0],[0.3,function _(){return (Transition(BLACK).fadeIn)(2)}],[__as_oak_string(2+2),function _(){return go(__Oak_String(`game`))}]],setOpac),onKeyPress(s(__Oak_String(`enter`)),function _(){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((CANCELLED__oak_qm=true),go(__Oak_String(`game`))):null)(!CANCELLED__oak_qm)})))()}),({Transition,_b2,newCut,notes,oK_,shakey,std})))()}),__oak_modularize(__Oak_String(`scenes/ware/cutscene.oak`),function _(){return ((Cutscene,_MAKE_Cutscene,_sh,_sw,newCut,std,stp)=>((std=__oak_module_import(__Oak_String(`std`))),(stp=__oak_module_import(__Oak_String(`web/step.oak`))),(_sh=(stp.createStepper)()),(_sw=(_sh.sw??null)),_MAKE_Cutscene=function _MAKE_Cutscene(sh=null,sw=null){let Cutscene;return Cutscene=function Cutscene(val=null,passthru=null){return (std.each)(val,function _(i=null){return (((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('function'))?sw(__oak_acc(i,0),__oak_acc(i,1)):sw(__oak_acc(i,0),function _(){return passthru(__oak_acc(i,1),[sh,sw])}))(type(__oak_acc(i,1))))})}},(Cutscene=_MAKE_Cutscene(_sh,_sw)),newCut=function newCut(){return ((sh,sw)=>(({sh:(sh=(stp.createStepper)()),sw:(sw=(sh.sw??null)),Cutscene:_MAKE_Cutscene(sh,sw)})))()},({Cutscene,_MAKE_Cutscene,_sh,_sw,newCut,std,stp})))()}),__oak_modularize(__Oak_String(`web/entry.oak`),function _(){return ((canvasBorder,canvasPos,fmt,gameHeight,gameWidth,json,oaka,path,scenes,std,str,updateCanvas,vv,worldify)=>((std=__oak_module_import(__Oak_String(`std`))),(str=__oak_module_import(__Oak_String(`str`))),(json=__oak_module_import(__Oak_String(`json`))),(fmt=__oak_module_import(__Oak_String(`fmt`))),(path=__oak_module_import(__Oak_String(`path`))),(oaka=__oak_module_import(__Oak_String(`web/oaka.oak`))),kaboom(({width:600,height:500})),(vv=visualViewport),(gameWidth=(canvas.width??null)),(gameHeight=(canvas.height??null)),worldify=function worldify(){return (({x:((((vv.width??null)/2))-((gameWidth/2))),y:((((vv.height??null)/2))-((gameHeight/2)))}))},(canvasPos=null),(canvasBorder=null),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(backgroundColor,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.backgroundColor):(__oak_assgn_tgt.backgroundColor)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(((document.body??null).style??null)),__Oak_String(`#000`)),updateCanvas=function updateCanvas(){return ((canvasPos=worldify()),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(display,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.display):(__oak_assgn_tgt.display)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((canvas.style??null)),__Oak_String(`flex`)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(position,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.position):(__oak_assgn_tgt.position)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((canvas.style??null)),__Oak_String(`absolute`)),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(left,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.left):(__oak_assgn_tgt.left)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((canvas.style??null)),__as_oak_string(s((canvasPos.x??null))+__Oak_String(`px`))),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(top,__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt.top):(__oak_assgn_tgt.top)=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string((canvas.style??null)),__as_oak_string(s((canvasPos.y??null))+__Oak_String(`px`))))},updateCanvas(),(scenes=__oak_module_import(__Oak_String(`scenes/main.oak`))),({canvasBorder,canvasPos,fmt,gameHeight,gameWidth,json,oaka,path,scenes,std,str,updateCanvas,vv,worldify})))()}),__oak_modularize(__Oak_String(`web/oaka.oak`),function _(){return ((abstr__oak_qm,assign,clense,__oak_js_do,fmt,json,kb,loadSprite,onKeyDown,path,s,sprite,std,str,w,windowBind,windowFullscreen__oak_qm)=>((std=__oak_module_import(__Oak_String(`std`))),(str=__oak_module_import(__Oak_String(`str`))),(json=__oak_module_import(__Oak_String(`json`))),(fmt=__oak_module_import(__Oak_String(`fmt`))),(path=__oak_module_import(__Oak_String(`path`))),(w=window),windowBind=function windowBind(...fns){return ((std.each)(fns,function _(it=null){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(((it.name??null)),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key(((it.name??null)))]):(__oak_assgn_tgt[__oak_obj_key(((it.name??null)))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(window),it),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((__as_oak_string(__Oak_String(`OK`)+(it.name??null))),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((__as_oak_string(__Oak_String(`OK`)+(it.name??null))))]):(__oak_assgn_tgt[__oak_obj_key((__as_oak_string(__Oak_String(`OK`)+(it.name??null))))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(window),it),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign(((it.name??null)),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key(((it.name??null)))]):(__oak_assgn_tgt[__oak_obj_key(((it.name??null)))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(globalThis),it),((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((__as_oak_string(__Oak_String(`OK`)+(it.name??null))),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((__as_oak_string(__Oak_String(`OK`)+(it.name??null))))]):(__oak_assgn_tgt[__oak_obj_key((__as_oak_string(__Oak_String(`OK`)+(it.name??null))))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(globalThis),it))}))},windowBind(s=function s(pl=null){return (string(pl).toString)()},kb=function kb(func=null,pls=null){return ((strings)=>((strings=(std.map)(pls,function _(it=null,i__oak_qm=null){return s(it)})),func(...strings)))()},__oak_js_do=function __oak_js_do(code=null){return eval(s(code))},assign=function assign(name=null,code=null){return ((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((string(name)),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((string(name)))]):(__oak_assgn_tgt[__oak_obj_key((string(name)))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(w),__oak_js_do(code))},abstr__oak_qm=function abstr__oak_qm(thing=null,op=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('string'))?op(thing):null)(type(thing))},windowFullscreen__oak_qm=function windowFullscreen__oak_qm(){return (__oak_eq((window.innerHeight??null),(screen.height??null)))},clense=function clense(args=null,pos=null){return abstr__oak_qm(__oak_acc(args,__oak_obj_key((pos))),function _(it=null){return (it=s(it))})},sprite=function sprite(...args){return (clense(args,0),(w.sprite)(...args))},loadSprite=function loadSprite(...args){return (kb((w.loadSprite??null),args))},onKeyDown=function onKeyDown(...args){return (clense(args,0),(w.onKeyDown)(...args))}),({abstr__oak_qm,assign,clense,__oak_js_do,fmt,json,kb,loadSprite,onKeyDown,path,s,sprite,std,str,w,windowBind,windowFullscreen__oak_qm})))()}),__oak_modularize(__Oak_String(`web/self.oak`),function _(){return ((createSelf)=>(createSelf=function createSelf(){return ((reco,th_)=>((th_=({})),({reco:reco=function reco(key=null,val=null){return (((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((key),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((key))]):(__oak_assgn_tgt[__oak_obj_key((key))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(th_),val))},set:function _(key=null,val=null){return (reco(key,val),val)},get:function _(key=null){return __oak_acc(th_,__oak_obj_key((key)))},__oak_js_this:function _(){return th_}})))()},({createSelf})))()}),__oak_modularize(__Oak_String(`web/step.oak`),function _(){return ((createStepper,mainThread,self)=>((self=__oak_module_import(__Oak_String(`web/self.oak`))),createStepper=function createStepper(){return ((get,reset,set,step,step_self,sw)=>((step_self=(self.createSelf)()),(step_self.set)(__Oak_String(`stepNum`),0),({get:get=function get(){return (step_self.get)(__Oak_String(`stepNum`))},set:set=function set(am=null){return (step_self.set)(__Oak_String(`stepNum`),am)},step:step=function step(am=null){return set(__as_oak_string(get()+am))},reset:reset=function reset(){return set(0)},sw:sw=function sw(am=null,cb=null){return wait(step(am),function _(){return cb(get())})}})))()},(mainThread=createStepper()),({createStepper,mainThread,self})))()}),__oak_modularize(__Oak_String(`datetime`),function _(){return ((DaysBeforeMonth,DaysFrom1To1970,DaysPer100Years,DaysPer400Years,DaysPer4Years,LeapDay,SecondsPerDay,ZeroYear,_describeClock,_describeDate,_parseTZOffset,__oak_js_default,describe,endsWith__oak_qm,fmtFormat,format,leap__oak_qm,map,merge,padEnd,padStart,parse,slice,split,strContains__oak_qm,strIndexOf,take,timestamp)=>(({__oak_js_default,map,take,slice,merge}=__oak_module_import(__Oak_String(`std`))),({endsWith__oak_qm,contains__oak_qm:strContains__oak_qm=null,indexOf:strIndexOf=null,padStart,padEnd,split}=__oak_module_import(__Oak_String(`str`))),({format:fmtFormat=null}=__oak_module_import(__Oak_String(`fmt`))),(LeapDay=__as_oak_string(31+28)),(SecondsPerDay=86400),(DaysPer4Years=__as_oak_string((365*4)+1)),(DaysPer100Years=((25*DaysPer4Years)-1)),(DaysPer400Years=__as_oak_string((DaysPer100Years*4)+1)),(ZeroYear=1),(DaysFrom1To1970=(((DaysPer400Years*5)-(365*31))-8)),(DaysBeforeMonth=[__Oak_Empty,0,31,__as_oak_string(31+28),__as_oak_string(__as_oak_string(31+28)+31),__as_oak_string(__as_oak_string(__as_oak_string(31+28)+31)+30),__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(31+28)+31)+30)+31),__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(31+28)+31)+30)+31)+30),__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(31+28)+31)+30)+31)+30)+31),__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(31+28)+31)+30)+31)+30)+31)+31),__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(31+28)+31)+30)+31)+30)+31)+31)+30),__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(31+28)+31)+30)+31)+30)+31)+31)+30)+31),__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(31+28)+31)+30)+31)+30)+31)+31)+30)+31)+30),__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(31+28)+31)+30)+31)+30)+31)+31)+30)+31)+30)+31)]),leap__oak_qm=function leap__oak_qm(year=null){return (__oak_left=>__oak_left===false?false:__oak_and(__oak_left,((__oak_left=>__oak_left===true?true:__oak_or(__oak_left,__oak_eq((year%400),0)))(!__oak_eq((year%100),0)))))(__oak_eq((year%4),0))},_describeDate=function _describeDate(t=null){return ((d,day,leapYear__oak_qm,month,n,n100,n4,n400,year)=>((d=__as_oak_string(int((((t-(t%SecondsPerDay)))/SecondsPerDay))+DaysFrom1To1970)),((__oak_cond)=>__oak_eq(__oak_cond,true)?(d=(d-1)):null)((__oak_left=>__oak_left===false?false:__oak_and(__oak_left,!__oak_eq((t%86400),0)))((t<0))),(n400=int((d/DaysPer400Years))),(d=(d-(DaysPer400Years*n400))),(n100=int((d/DaysPer100Years))),(n100=(n100-int((n100/4)))),(d=(d-(DaysPer100Years*n100))),(n4=int((d/DaysPer4Years))),(d=(d-(DaysPer4Years*n4))),(n=int((d/365))),(n=(n-int((n/4)))),(d=(d-(365*n))),(year=__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string(ZeroYear+(400*n400))+(100*n100))+(4*n4))+n)),(month=0),(day=d),(leapYear__oak_qm=leap__oak_qm(year)),((__oak_cond)=>__oak_eq(__oak_cond,(__oak_left=>__oak_left===false?false:__oak_and(__oak_left,__oak_eq(day,LeapDay)))(leapYear__oak_qm))?((month=2),(day=29)):((subMonth)=>(((__oak_cond)=>__oak_eq(__oak_cond,true)?(day=(day-1)):null)((__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(day>LeapDay)))(leapYear__oak_qm)),subMonth=function subMonth(m=null){return ((__oak_trampolined_subMonth)=>((__oak_trampolined_subMonth=function _(m=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?m:__oak_trampoline(__oak_trampolined_subMonth,__as_oak_string(m+1)))((day<__oak_acc(DaysBeforeMonth,__oak_obj_key((__as_oak_string(m+1))))))}),__oak_resolve_trampoline(__oak_trampolined_subMonth,m)))()},(month=subMonth(1)),(day=__as_oak_string((day-__oak_acc(DaysBeforeMonth,__oak_obj_key((month))))+1))))())(true),({year,month,day})))()},_describeClock=function _describeClock(t=null){return ((hour,minute,rem)=>((rem=(t%SecondsPerDay)),((__oak_cond)=>__oak_eq(__oak_cond,true)?(rem=__as_oak_string(rem+SecondsPerDay)):null)((rem<0)),(hour=int((rem/3600))),(rem=(rem%3600)),(minute=int((rem/60))),({hour,minute,second:(rem%60)})))()},describe=function describe(t=null){return merge(_describeDate(t),_describeClock(t))},timestamp=function timestamp(desc=null){return ((day,daysFrom1,daysFrom1970,daysYearToDate,hour,leapYear__oak_qm,minute,month,n100,n4,n400,second,year)=>(({year,month,day,hour,minute,second}=desc),(leapYear__oak_qm=leap__oak_qm(year)),(year=(year-ZeroYear)),(n400=int((year/400))),(year=(year%400)),(n100=int((year/100))),(year=(year%100)),(n4=int((year/4))),(year=(year%4)),(daysYearToDate=((__oak_cond)=>__oak_eq(__oak_cond,true)?((__oak_cond)=>__oak_eq(__oak_cond,__oak_eq(month,1))?(__as_oak_string(__oak_acc(DaysBeforeMonth,__oak_obj_key((month)))+day)-1):__oak_eq(__oak_cond,(__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(day<29)))(__oak_eq(month,2)))?(__as_oak_string(__oak_acc(DaysBeforeMonth,__oak_obj_key((month)))+day)-1):__oak_eq(__oak_cond,(__oak_left=>__oak_left===false?false:__oak_and(__oak_left,__oak_eq(day,29)))(__oak_eq(month,2)))?59:__as_oak_string(__oak_acc(DaysBeforeMonth,__oak_obj_key((month)))+day))(true):(__as_oak_string(__oak_acc(DaysBeforeMonth,__oak_obj_key((month)))+day)-1))(leapYear__oak_qm)),(daysFrom1=__as_oak_string(__as_oak_string(__as_oak_string(__as_oak_string((DaysPer400Years*n400)+(DaysPer100Years*n100))+(DaysPer4Years*n4))+(365*year))+daysYearToDate)),(daysFrom1970=(daysFrom1-DaysFrom1To1970)),__as_oak_string(__as_oak_string(__as_oak_string((daysFrom1970*SecondsPerDay)+(3600*hour))+(60*minute))+second)))()},format=function format(t=null,tzOffset=null){return ((day,hour,minute,month,second,year)=>((tzOffset=__oak_js_default(tzOffset,0)),({year,month,day,hour,minute,second}=describe(__as_oak_string(t+(tzOffset*60)))),fmtFormat(__Oak_String(`{{0}}-{{1}}-{{2}}T{{3}}:{{4}}:{{5}}{{6}}`),((__oak_cond)=>__oak_eq(__oak_cond,(year>9999))?padStart(string(year),6,__Oak_String(`0`)):__oak_eq(__oak_cond,(year<0))?__oak_push(__Oak_String(`-`),padStart(string(-year),6,__Oak_String(`0`))):padStart(string(year),4,__Oak_String(`0`)))(true),padStart(string(month),2,__Oak_String(`0`)),padStart(string(day),2,__Oak_String(`0`)),padStart(string(hour),2,__Oak_String(`0`)),padStart(string(minute),2,__Oak_String(`0`)),padStart(string(second),2,__Oak_String(`0`)),((__oak_cond)=>__oak_eq(__oak_cond,__oak_eq(tzOffset,0))?__Oak_String(`Z`):__oak_eq(__oak_cond,(tzOffset>0))?__oak_push(__Oak_String(`+`),fmtFormat(__Oak_String(`{{0}}:{{1}}`),padStart(string(int((tzOffset/60))),2,__Oak_String(`0`)),padStart(string((tzOffset%60)),2,__Oak_String(`0`)))):__oak_push(__Oak_String(`-`),fmtFormat(__Oak_String(`{{0}}:{{1}}`),padStart(string(int((-tzOffset/60))),2,__Oak_String(`0`)),padStart(string((-tzOffset%60)),2,__Oak_String(`0`)))))(true))))()},_parseTZOffset=function _parseTZOffset(offsetString=null){let hh;let mm;return ((__oak_cond)=>__oak_eq(__oak_cond,[])?null:__oak_eq(__oak_cond,[__Oak_Empty])?null:__oak_eq(__oak_cond,[null,__Oak_Empty])?null:__oak_eq(__oak_cond,[__Oak_Empty,null])?null:__as_oak_string((hh*60)+mm))(([hh=null,mm=null]=map(split(offsetString,__Oak_String(`:`)),int)))},parse=function parse(s=null){let clock;let date;let day;let hour;let minute;let month;let second;let year;return ((__oak_cond)=>__oak_eq(__oak_cond,[])?null:__oak_eq(__oak_cond,[__Oak_Empty])?null:__oak_eq(__oak_cond,[null,__Oak_Empty])?null:__oak_eq(__oak_cond,[__Oak_Empty,null])?null:((__oak_cond)=>__oak_eq(__oak_cond,[])?null:__oak_eq(__oak_cond,[__Oak_Empty])?null:__oak_eq(__oak_cond,[__Oak_Empty,__Oak_Empty])?null:__oak_eq(__oak_cond,[null,__Oak_Empty,__Oak_Empty])?null:__oak_eq(__oak_cond,[__Oak_Empty,null,__Oak_Empty])?null:__oak_eq(__oak_cond,[__Oak_Empty,__Oak_Empty,null])?null:((__oak_cond)=>__oak_eq(__oak_cond,[])?null:__oak_eq(__oak_cond,[__Oak_Empty])?null:__oak_eq(__oak_cond,[__Oak_Empty,__Oak_Empty])?null:__oak_eq(__oak_cond,[null,__Oak_Empty,__Oak_Empty])?null:__oak_eq(__oak_cond,[__Oak_Empty,null,__Oak_Empty])?null:__oak_eq(__oak_cond,[__Oak_Empty,__Oak_Empty,null])?null:((maybeMillis,parsed,tzOffset)=>(([__oak_empty_assgn_tgt=null,maybeMillis=null]=map(map(split(clock,__Oak_String(`.`)),function _(s=null){return take(s,3)}),int)),(tzOffset=((__oak_cond)=>__oak_eq(__oak_cond,strContains__oak_qm(clock,__Oak_String(`+`)))?_parseTZOffset(slice(clock,__as_oak_string(strIndexOf(clock,__Oak_String(`+`))+1))):__oak_eq(__oak_cond,strContains__oak_qm(clock,__Oak_String(`-`)))?((__oak_cond)=>__oak_eq(__oak_cond,null)?null:-parsed)((parsed=_parseTZOffset(slice(clock,__as_oak_string(strIndexOf(clock,__Oak_String(`-`))+1))))):0)(true)),((__oak_cond)=>__oak_eq(__oak_cond,true)?({year,month,day,hour,minute,second,millis:__oak_js_default(maybeMillis,0),tzOffset}):null)(!__oak_eq(tzOffset,null))))())(([hour=null,minute=null,second=null]=map(split(take(clock,8),__Oak_String(`:`)),int))))(([year=null,month=null,day=null]=map(split(date,__Oak_String(`-`)),int))))(([date=null,clock=null]=split(s,__Oak_String(`T`))))},({DaysBeforeMonth,DaysFrom1To1970,DaysPer100Years,DaysPer400Years,DaysPer4Years,LeapDay,SecondsPerDay,ZeroYear,_describeClock,_describeDate,_parseTZOffset,__oak_js_default,describe,endsWith__oak_qm,fmtFormat,format,leap__oak_qm,map,merge,padEnd,padStart,parse,slice,split,strContains__oak_qm,strIndexOf,take,timestamp})))()}),__oak_modularize(__Oak_String(`fmt`),function _(){return ((__oak_js_default,format,printf,println)=>(({println,__oak_js_default}=__oak_module_import(__Oak_String(`std`))),format=function format(raw=null,...values){return ((buf,key,sub,value,which)=>((which=0),(key=__Oak_String(``)),(buf=__Oak_String(``)),(value=__oak_js_default(__oak_acc(values,0),({}))),sub=function sub(idx=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(idx=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((c)=>((c=__oak_acc(raw,__oak_obj_key((idx)))),((__oak_cond)=>__oak_eq(__oak_cond,0)?((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`{`))?(which=1):__oak_push(buf,c))(c):__oak_eq(__oak_cond,1)?((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`{`))?(which=2):(__oak_push(__oak_push(buf,__Oak_String(`{`)),c),(which=0)))(c):__oak_eq(__oak_cond,2)?((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`}`))?((index)=>((index=int(key)),__oak_push(buf,string(((__oak_cond)=>__oak_eq(__oak_cond,__oak_eq(key,__Oak_String(``)))?__Oak_String(``):__oak_eq(__oak_cond,__oak_eq(index,null))?__oak_acc(value,__oak_obj_key((key))):__oak_acc(values,__oak_obj_key((index))))(true))),(key=__Oak_String(``)),(which=3)))():__oak_eq(__oak_cond,__Oak_String(` `))?null:__oak_eq(__oak_cond,__Oak_String(`	`))?null:(key=__as_oak_string(key+c)))(c):__oak_eq(__oak_cond,3)?((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`}`))?(which=0):null)(c):null)(which),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(idx+1))))():buf)((idx<len(raw)))}),__oak_resolve_trampoline(__oak_trampolined_sub,idx)))()},sub(0)))()},printf=function printf(raw=null,...values){return println(format(raw,...values))},({__oak_js_default,format,printf,println})))()}),__oak_modularize(__Oak_String(`json`),function _(){return ((Reader,_parseReader,__oak_js_default,esc,escape,join,map,parse,parseFalse,parseList,parseNull,parseNumber,parseObject,parseString,parseTrue,serialize,slice,space__oak_qm)=>(({__oak_js_default,slice,map}=__oak_module_import(__Oak_String(`std`))),({space__oak_qm,join}=__oak_module_import(__Oak_String(`str`))),esc=function esc(c=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`	`))?__Oak_String(`\\t`):__oak_eq(__oak_cond,__Oak_String(`
`))?__Oak_String(`\\n`):__oak_eq(__oak_cond,__Oak_String(``))?__Oak_String(`\\r`):__oak_eq(__oak_cond,__Oak_String(``))?__Oak_String(`\\f`):__oak_eq(__oak_cond,__Oak_String(`"`))?__Oak_String(`\\"`):__oak_eq(__oak_cond,__Oak_String(`\\`))?__Oak_String(`\\\\`):c)(c)},escape=function escape(s=null){return ((max,sub)=>((max=len(s)),sub=function sub(i=null,acc=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null,acc=null){return ((__oak_cond)=>__oak_eq(__oak_cond,max)?acc:__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1),__oak_push(acc,esc(__oak_acc(s,__oak_obj_key((i)))))))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,i,acc)))()},sub(0,__Oak_String(``))))()},serialize=function serialize(c=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('null'))?__Oak_String(`null`):__oak_eq(__oak_cond,Symbol.for('empty'))?__Oak_String(`null`):__oak_eq(__oak_cond,Symbol.for('function'))?__Oak_String(`null`):__oak_eq(__oak_cond,Symbol.for('string'))?__oak_push(__oak_push(__Oak_String(`"`),escape(c)),__Oak_String(`"`)):__oak_eq(__oak_cond,Symbol.for('atom'))?__oak_push(__oak_push(__Oak_String(`"`),string(c)),__Oak_String(`"`)):__oak_eq(__oak_cond,Symbol.for('int'))?string(c):__oak_eq(__oak_cond,Symbol.for('float'))?string(c):__oak_eq(__oak_cond,Symbol.for('bool'))?string(c):__oak_eq(__oak_cond,Symbol.for('list'))?__oak_push(__oak_push(__Oak_String(`[`),join(map(c,serialize),__Oak_String(`,`))),__Oak_String(`]`)):__oak_eq(__oak_cond,Symbol.for('object'))?__oak_push(__oak_push(__Oak_String(`{`),join(map(keys(c),function _(k=null){return __oak_push(__oak_push(__oak_push(__Oak_String(`"`),escape(k)),__Oak_String(`":`)),serialize(__oak_acc(c,__oak_obj_key((k)))))}),__Oak_String(`,`))),__Oak_String(`}`)):null)(type(c))},Reader=function Reader(s=null){return ((err__oak_qm,forward,index,next,nextWord,peek)=>((index=0),(err__oak_qm=false),next=function next(){return ((index=__as_oak_string(index+1)),__oak_js_default(__oak_acc(s,__oak_obj_key(((index-1)))),__Oak_String(``)))},peek=function peek(){return __oak_js_default(__oak_acc(s,__oak_obj_key((index))),__Oak_String(``))},nextWord=function nextWord(n=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((index=len(s)),null):((word)=>((word=slice(s,index,__as_oak_string(index+n))),(index=__as_oak_string(index+n)),word))())((__as_oak_string(index+n)>len(s)))},forward=function forward(){return ((sub)=>(sub=function sub(){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((index=__as_oak_string(index+1)),__oak_trampoline(__oak_trampolined_sub)):null)(space__oak_qm(peek()))}),__oak_resolve_trampoline(__oak_trampolined_sub)))()},sub()))()},({next,peek,forward,nextWord,done__oak_qm:function _(){return (index>=len(s))},err__oak_exclam:function _(){return ((err__oak_qm=true),Symbol.for('error'))},err__oak_qm:function _(){return err__oak_qm}})))()},parseNull=function parseNull(r=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`null`))?null:(r.err__oak_exclam)())((r.nextWord)(4))},parseString=function parseString(r=null){return ((next,sub)=>((next=(r.next??null)),next(),sub=function sub(acc=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null){let c;return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(``))?(r.err__oak_exclam)():__oak_eq(__oak_cond,__Oak_String(`\\`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`t`))?__Oak_String(`	`):__oak_eq(__oak_cond,__Oak_String(`n`))?__Oak_String(`
`):__oak_eq(__oak_cond,__Oak_String(`r`))?__Oak_String(``):__oak_eq(__oak_cond,__Oak_String(`f`))?__Oak_String(``):__oak_eq(__oak_cond,__Oak_String(`"`))?__Oak_String(`"`):c)((c=next())))):__oak_eq(__oak_cond,__Oak_String(`"`))?acc:__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,c)))((c=next()))}),__oak_resolve_trampoline(__oak_trampolined_sub,acc)))()},sub(__Oak_String(``))))()},parseNumber=function parseNumber(r=null){return ((decimal__oak_qm,negate__oak_qm,next,parsed,peek,result,sub)=>((peek=(r.peek??null)),(next=(r.next??null)),(decimal__oak_qm=false),(negate__oak_qm=((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`-`))?(next(),true):false)(peek())),sub=function sub(acc=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`.`))?((__oak_cond)=>__oak_eq(__oak_cond,true)?(r.err__oak_exclam)():((decimal__oak_qm=true),__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next()))))(decimal__oak_qm):__oak_eq(__oak_cond,__Oak_String(`0`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next())):__oak_eq(__oak_cond,__Oak_String(`1`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next())):__oak_eq(__oak_cond,__Oak_String(`2`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next())):__oak_eq(__oak_cond,__Oak_String(`3`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next())):__oak_eq(__oak_cond,__Oak_String(`4`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next())):__oak_eq(__oak_cond,__Oak_String(`5`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next())):__oak_eq(__oak_cond,__Oak_String(`6`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next())):__oak_eq(__oak_cond,__Oak_String(`7`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next())):__oak_eq(__oak_cond,__Oak_String(`8`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next())):__oak_eq(__oak_cond,__Oak_String(`9`))?__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,next())):acc)(peek())}),__oak_resolve_trampoline(__oak_trampolined_sub,acc)))()},(result=sub(__Oak_String(``))),((__oak_cond)=>__oak_eq(__oak_cond,null)?Symbol.for('error'):((__oak_cond)=>__oak_eq(__oak_cond,true)?-parsed:parsed)(negate__oak_qm))((parsed=((__oak_cond)=>__oak_eq(__oak_cond,true)?float(result):int(result))(decimal__oak_qm)))))()},parseTrue=function parseTrue(r=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`true`))?true:(r.err__oak_exclam)())((r.nextWord)(4))},parseFalse=function parseFalse(r=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`false`))?false:(r.err__oak_exclam)())((r.nextWord)(5))},parseList=function parseList(r=null){return ((err__oak_qm,forward,next,peek,sub)=>((err__oak_qm=(r.err__oak_qm??null)),(peek=(r.peek??null)),(next=(r.next??null)),(forward=(r.forward??null)),next(),forward(),sub=function sub(acc=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?Symbol.for('error'):((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(``))?(r.err__oak_exclam)():__oak_eq(__oak_cond,__Oak_String(`]`))?(next(),acc):(__oak_push(acc,_parseReader(r)),forward(),((__oak_cond)=>__oak_eq(__oak_cond,true)?next():null)(__oak_eq(peek(),__Oak_String(`,`))),forward(),__oak_trampoline(__oak_trampolined_sub,acc)))(peek()))(err__oak_qm())}),__oak_resolve_trampoline(__oak_trampolined_sub,acc)))()},sub([])))()},parseObject=function parseObject(r=null){return ((err__oak_qm,forward,next,peek,sub)=>((err__oak_qm=(r.err__oak_qm??null)),(peek=(r.peek??null)),(next=(r.next??null)),(forward=(r.forward??null)),next(),forward(),sub=function sub(acc=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?Symbol.for('error'):((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(``))?(r.err__oak_exclam)():__oak_eq(__oak_cond,__Oak_String(`}`))?(next(),acc):((key)=>((key=parseString(r)),((__oak_cond)=>__oak_eq(__oak_cond,true)?((val)=>(forward(),((__oak_cond)=>__oak_eq(__oak_cond,true)?next():null)(__oak_eq(peek(),__Oak_String(`:`))),(val=_parseReader(r)),((__oak_cond)=>__oak_eq(__oak_cond,true)?(forward(),((__oak_cond)=>__oak_eq(__oak_cond,true)?next():null)(__oak_eq(peek(),__Oak_String(`,`))),forward(),__oak_trampoline(__oak_trampolined_sub,((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((key),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((key))]):(__oak_assgn_tgt[__oak_obj_key((key))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(acc),val))):null)(!err__oak_qm())))():null)(!err__oak_qm())))())(peek()))(err__oak_qm())}),__oak_resolve_trampoline(__oak_trampolined_sub,acc)))()},sub(({}))))()},_parseReader=function _parseReader(r=null){return ((result)=>((r.forward)(),(result=((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(`n`))?parseNull(r):__oak_eq(__oak_cond,__Oak_String(`"`))?parseString(r):__oak_eq(__oak_cond,__Oak_String(`t`))?parseTrue(r):__oak_eq(__oak_cond,__Oak_String(`f`))?parseFalse(r):__oak_eq(__oak_cond,__Oak_String(`[`))?parseList(r):__oak_eq(__oak_cond,__Oak_String(`{`))?parseObject(r):parseNumber(r))((r.peek)())),((__oak_cond)=>__oak_eq(__oak_cond,true)?Symbol.for('error'):result)((r.err__oak_qm)())))()},parse=function parse(s=null){return _parseReader(Reader(s))},({Reader,_parseReader,__oak_js_default,esc,escape,join,map,parse,parseFalse,parseList,parseNull,parseNumber,parseObject,parseString,parseTrue,serialize,slice,space__oak_qm})))()}),__oak_modularize(__Oak_String(`path`),function _(){return ((_lastSlash,abs__oak_qm,base,clean,cut,__oak_js_default,dir,filter,join,reduce,rel__oak_qm,resolve,slice,split,strJoin,strSplit,trimEnd)=>(({__oak_js_default,slice,filter,reduce}=__oak_module_import(__Oak_String(`std`))),({join:strJoin=null,split:strSplit=null,trimEnd}=__oak_module_import(__Oak_String(`str`))),abs__oak_qm=function abs__oak_qm(path=null){return __oak_eq(__oak_acc(path,0),__Oak_String(`/`))},rel__oak_qm=function rel__oak_qm(path=null){return !__oak_eq(__oak_acc(path,0),__Oak_String(`/`))},_lastSlash=function _lastSlash(path=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(``))?0:((sub)=>(sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,null)?i:__oak_eq(__oak_cond,__Oak_String(`/`))?i:__oak_trampoline(__oak_trampolined_sub,(i-1)))(__oak_acc(path,__oak_obj_key((i))))}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub((len(path)-1))))())(path)},dir=function dir(path=null){return ((path=trimEnd(path,__Oak_String(`/`))),slice(path,0,_lastSlash(path)))},base=function base(path=null){return ((path=trimEnd(path,__Oak_String(`/`))),slice(path,__as_oak_string(_lastSlash(path)+1)))},cut=function cut(path=null){return ((lastSlash)=>((path=trimEnd(path,__Oak_String(`/`))),(lastSlash=_lastSlash(path)),[slice(path,0,lastSlash),slice(path,__as_oak_string(lastSlash+1))]))()},clean=function clean(path=null){return ((cleaned,rooted)=>((rooted=__oak_eq(__oak_acc(path,0),__Oak_String(`/`))),(cleaned=strJoin(reduce(strSplit(path,__Oak_String(`/`)),[],function _(parts=null,part=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(``))?parts:__oak_eq(__oak_cond,__Oak_String(`.`))?parts:__oak_eq(__oak_cond,__Oak_String(`..`))?((__oak_cond)=>__oak_eq(__oak_cond,0)?__oak_push(parts,part):slice(parts,0,(len(parts)-1)))(i):__oak_push(parts,part))(part)}),__Oak_String(`/`))),((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_push(__Oak_String(`/`),cleaned):cleaned)(rooted)))()},join=function join(...parts){return clean(reduce(parts,__Oak_String(``),function _(base=null,path=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(``))?__oak_push(__Oak_String(``),path):__oak_push(__oak_push(base,__Oak_String(`/`)),path))(base)}))},split=function split(path=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(``))?[]:filter(strSplit(path,__Oak_String(`/`)),function _(s=null){return !__oak_eq(s,__Oak_String(``))}))(trimEnd(path,__Oak_String(`/`)))},resolve=function resolve(path=null,base=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?path:join(__oak_js_default(base,(env().PWD??null)),path))(abs__oak_qm(path))},({_lastSlash,abs__oak_qm,base,clean,cut,__oak_js_default,dir,filter,join,reduce,rel__oak_qm,resolve,slice,split,strJoin,strSplit,trimEnd})))()}),__oak_modularize(__Oak_String(`random`),function _(){return ((boolean,choice,integer,number)=>(boolean=function boolean(){return (rand()>0.5)},integer=function integer(min=null,max=null){return int(number(int(min),int(max)))},number=function number(min=null,max=null){return (((__oak_cond)=>__oak_eq(__oak_cond,true)?([min=null,max=null]=[0,min]):null)(__oak_eq(max,null)),__as_oak_string(min+(rand()*((max-min)))))},choice=function choice(list=null){return __oak_acc(list,__oak_obj_key((integer(0,len(list)))))},({boolean,choice,integer,number})))()}),__oak_modularize(__Oak_String(`std`),function _(){return ((_asPredicate,_baseIterator,_hToN,_nToH,append,clamp,clone,compact,contains__oak_qm,debounce,__oak_js_default,each,entries,every,filter,find,first,flatten,fromHex,identity,indexOf,join,last,loop,map,merge,once,partition,println,range,reduce,reverse,slice,some,stdin,take,takeLast,toHex,uniq,values,zip)=>(identity=function identity(x=null){return x},_baseIterator=function _baseIterator(v=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('string'))?__Oak_String(``):__oak_eq(__oak_cond,Symbol.for('list'))?[]:__oak_eq(__oak_cond,Symbol.for('object'))?({}):null)(type(v))},_asPredicate=function _asPredicate(pred=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('atom'))?((prop)=>((prop=string(pred)),function _(x=null){return __oak_acc(x,__oak_obj_key((prop)))}))():__oak_eq(__oak_cond,Symbol.for('string'))?function _(x=null){return __oak_acc(x,__oak_obj_key((pred)))}:__oak_eq(__oak_cond,Symbol.for('int'))?function _(x=null){return __oak_acc(x,__oak_obj_key((pred)))}:pred)(type(pred))},__oak_js_default=function __oak_js_default(x=null,base=null){return ((__oak_cond)=>__oak_eq(__oak_cond,null)?base:x)(x)},(_nToH=__Oak_String(`0123456789abcdef`)),toHex=function toHex(n=null){return ((sub)=>(sub=function sub(p=null,acc=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(p=null,acc=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?__as_oak_string(__oak_acc(_nToH,__oak_obj_key((p)))+acc):__oak_trampoline(__oak_trampolined_sub,int((p/16)),__as_oak_string(__oak_acc(_nToH,__oak_obj_key(((p%16))))+acc)))((p<16))}),__oak_resolve_trampoline(__oak_trampolined_sub,p,acc)))()},sub(int(n),__Oak_String(``))))()},(_hToN=({0:0,1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,a:10,A:10,b:11,B:11,c:12,C:12,d:13,D:13,e:14,E:14,f:15,F:15})),fromHex=function fromHex(s=null){return ((sub)=>(sub=function sub(i=null,acc=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null,acc=null){let next;return ((__oak_cond)=>__oak_eq(__oak_cond,__oak_eq(i,len(s)))?acc:__oak_eq(__oak_cond,!__oak_eq(null,(next=__oak_acc(_hToN,__oak_obj_key((__oak_acc(s,__oak_obj_key((i)))))))))?__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1),__as_oak_string((acc*16)+next)):null)(true)}),__oak_resolve_trampoline(__oak_trampolined_sub,i,acc)))()},sub(0,0)))()},clamp=function clamp(min=null,max=null,n=null,m=null){return ((n=((__oak_cond)=>__oak_eq(__oak_cond,true)?min:n)((n<min))),(m=((__oak_cond)=>__oak_eq(__oak_cond,true)?min:m)((m<min))),(m=((__oak_cond)=>__oak_eq(__oak_cond,true)?max:m)((m>max))),(n=((__oak_cond)=>__oak_eq(__oak_cond,true)?m:n)((n>m))),[n,m])},slice=function slice(xs=null,min=null,max=null){return ((sub)=>((min=__oak_js_default(min,0)),(max=__oak_js_default(max,len(xs))),([min=null,max=null]=clamp(0,len(xs),min,max)),sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,max)?acc:__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,__oak_acc(xs,__oak_obj_key((i)))),__as_oak_string(i+1)))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(_baseIterator(xs),min)))()},clone=function clone(x=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('string'))?__as_oak_string(__Oak_String(``)+x):__oak_eq(__oak_cond,Symbol.for('list'))?slice(x):__oak_eq(__oak_cond,Symbol.for('object'))?reduce(keys(x),({}),function _(acc=null,key=null){return ((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((key),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((key))]):(__oak_assgn_tgt[__oak_obj_key((key))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(acc),__oak_acc(x,__oak_obj_key((key))))}):x)(type(x))},range=function range(start=null,end=null,step=null){return ((step=__oak_js_default(step,1)),((__oak_cond)=>__oak_eq(__oak_cond,true)?([start=null,end=null]=[0,start]):null)(__oak_eq(end,null)),((__oak_cond)=>__oak_eq(__oak_cond,0)?[]:((list,sub)=>((list=[]),((__oak_cond)=>__oak_eq(__oak_cond,true)?sub=function sub(n=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(n=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?(__oak_push(list,n),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(n+step))):list)((n<end))}),__oak_resolve_trampoline(__oak_trampolined_sub,n)))()}:sub=function sub(n=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(n=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?(__oak_push(list,n),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(n+step))):list)((n>end))}),__oak_resolve_trampoline(__oak_trampolined_sub,n)))()})((step>0)),sub(start)))())(step))},reverse=function reverse(xs=null){return ((sub)=>(sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?acc:__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,__oak_acc(xs,__oak_obj_key((i)))),(i-1)))((i<0))}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(_baseIterator(xs),(len(xs)-1))))()},map=function map(xs=null,f=null){return ((sub)=>((f=_asPredicate(f)),sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?acc:__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,f(__oak_acc(xs,__oak_obj_key((i))),i)),__as_oak_string(i+1)))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(_baseIterator(xs),0)))()},each=function each(xs=null,f=null){return ((sub)=>(sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?null:(f(__oak_acc(xs,__oak_obj_key((i))),i),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1))))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub(0)))()},filter=function filter(xs=null,f=null){return ((sub)=>((f=_asPredicate(f)),sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?acc:((x)=>(((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_push(acc,x):null)(f((x=__oak_acc(xs,__oak_obj_key((i)))),i)),__oak_trampoline(__oak_trampolined_sub,acc,__as_oak_string(i+1))))())(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(_baseIterator(xs),0)))()},reduce=function reduce(xs=null,seed=null,f=null){return ((sub)=>(sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?acc:__oak_trampoline(__oak_trampolined_sub,f(acc,__oak_acc(xs,__oak_obj_key((i))),i),__as_oak_string(i+1)))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(seed,0)))()},flatten=function flatten(xs=null){return reduce(xs,[],append)},compact=function compact(xs=null){return filter(xs,function _(x=null){return !__oak_eq(x,null)})},some=function some(xs=null,pred=null){return ((pred=__oak_js_default(pred,identity)),reduce(xs,false,function _(acc=null,x=null,i=null){return (__oak_left=>__oak_left===true?true:__oak_or(__oak_left,pred(x,i)))(acc)}))},every=function every(xs=null,pred=null){return ((pred=__oak_js_default(pred,identity)),reduce(xs,true,function _(acc=null,x=null,i=null){return (__oak_left=>__oak_left===false?false:__oak_and(__oak_left,pred(x,i)))(acc)}))},append=function append(xs=null,ys=null){return reduce(ys,xs,function _(zs=null,y=null){return __oak_push(zs,y)})},join=function join(xs=null,ys=null){return append(clone(xs),ys)},zip=function zip(xs=null,ys=null,zipper=null){return ((max,sub)=>((zipper=__oak_js_default(zipper,function _(x=null,y=null){return [x,y]})),(max=((__oak_cond)=>__oak_eq(__oak_cond,true)?len(xs):len(ys))((len(xs)<len(ys)))),sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,max)?acc:__oak_trampoline(__oak_trampolined_sub,__oak_push(acc,zipper(__oak_acc(xs,__oak_obj_key((i))),__oak_acc(ys,__oak_obj_key((i))),i)),__as_oak_string(i+1)))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub([],0)))()},partition=function partition(xs=null,by=null){return ((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('int'))?reduce(xs,[],function _(acc=null,x=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?__oak_push(acc,[x]):(__oak_push(__oak_acc(acc,__oak_obj_key(((len(acc)-1)))),x),acc))((i%by))}):__oak_eq(__oak_cond,Symbol.for('function'))?((last)=>((last=function _(){return null}),reduce(xs,[],function _(acc=null,x=null){return ((__oak_js_this)=>(((__oak_cond)=>__oak_eq(__oak_cond,last)?__oak_push(__oak_acc(acc,__oak_obj_key(((len(acc)-1)))),x):__oak_push(acc,[x]))((__oak_js_this=by(x))),(last=__oak_js_this),acc))()})))():null)(type(by))},uniq=function uniq(xs=null,pred=null){return ((last,sub,ys)=>((pred=__oak_js_default(pred,identity)),(ys=_baseIterator(xs)),(last=function _(){return null}),sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){let p;let x;return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?ys:((__oak_cond)=>__oak_eq(__oak_cond,last)?__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)):(__oak_push(ys,x),(last=p),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1))))((p=pred((x=__oak_acc(xs,__oak_obj_key((i))))))))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub(0)))()},first=function first(xs=null){return __oak_acc(xs,0)},last=function last(xs=null){return __oak_acc(xs,__oak_obj_key(((len(xs)-1))))},take=function take(xs=null,n=null){return slice(xs,0,n)},takeLast=function takeLast(xs=null,n=null){return slice(xs,(len(xs)-n))},find=function find(xs=null,pred=null){return ((sub)=>(sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?-1:((__oak_cond)=>__oak_eq(__oak_cond,true)?i:__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)))(pred(__oak_acc(xs,__oak_obj_key((i))))))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub(0)))()},indexOf=function indexOf(xs=null,x=null){return ((sub)=>(sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,len(xs))?-1:((__oak_cond)=>__oak_eq(__oak_cond,x)?i:__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)))(__oak_acc(xs,__oak_obj_key((i)))))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub(0)))()},contains__oak_qm=function contains__oak_qm(xs=null,x=null){return (indexOf(xs,x)>-1)},values=function values(obj=null){return map(keys(obj),function _(key=null){return __oak_acc(obj,__oak_obj_key((key)))})},entries=function entries(obj=null){return map(keys(obj),function _(key=null){return [key,__oak_acc(obj,__oak_obj_key((key)))]})},merge=function merge(...os){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?null:reduce(os,__oak_acc(os,0),function _(acc=null,o=null){return (reduce(keys(o),acc,function _(root=null,k=null){return ((__oak_assgn_tgt,__oak_assgn_val)=>(__is_oak_string(__oak_assgn_tgt)?__oak_assgn_tgt.assign((k),__oak_assgn_val):__oak_assgn_val===__Oak_Empty?delete (__oak_assgn_tgt[__oak_obj_key((k))]):(__oak_assgn_tgt[__oak_obj_key((k))])=__oak_assgn_val,__oak_assgn_tgt))(__as_oak_string(root),__oak_acc(o,__oak_obj_key((k))))}))}))(len(os))},once=function once(f=null){return ((called__oak_qm)=>((called__oak_qm=false),function _(...args){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((called__oak_qm=true),f(...args)):null)(!called__oak_qm)}))()},loop=function loop(max=null,f=null){return ((breaker,broken,ret,sub)=>(((__oak_cond)=>__oak_eq(__oak_cond,true)?([max=null,f=null]=[-1,max]):null)(__oak_eq(f,null)),(max=__oak_js_default(max,-1)),(ret=null),(broken=false),breaker=function breaker(x=null){return ((ret=x),(broken=true))},sub=function sub(count=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(count=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((__oak_cond)=>__oak_eq(__oak_cond,broken)?ret:(f(count,breaker),__oak_trampoline(__oak_trampolined_sub,__as_oak_string(count+1))))(true):null)(!__oak_eq(count,max))}),__oak_resolve_trampoline(__oak_trampolined_sub,count)))()},sub(0)))()},debounce=function debounce(duration=null,firstCall=null,f=null){return ((dargs,debounced,target,waiting__oak_qm)=>(((__oak_cond)=>__oak_eq(__oak_cond,true)?([firstCall=null,f=null]=[Symbol.for('trailing'),firstCall]):null)(__oak_eq(f,null)),(dargs=null),(waiting__oak_qm=false),(target=(time()-duration)),debounced=function debounced(...args){return ((tcall)=>((tcall=time()),(dargs=args),((__oak_cond)=>__oak_eq(__oak_cond,true)?((__oak_cond)=>__oak_eq(__oak_cond,true)?((target=__as_oak_string(tcall+duration)),((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('leading'))?f(...dargs):__oak_eq(__oak_cond,Symbol.for('trailing'))?((waiting__oak_qm=true),wait((target-time()),function _(){return ((waiting__oak_qm=false),f(...dargs))})):null)(firstCall)):((timeout)=>((waiting__oak_qm=true),(timeout=(target-tcall)),(target=__as_oak_string(target+duration)),wait(timeout,function _(){return ((waiting__oak_qm=false),f(...dargs))})))())((target<=tcall)):null)(!waiting__oak_qm)))()}))()},stdin=function stdin(){return ((file)=>((file=__Oak_String(``)),loop(function _(__oak_empty_ident0=null,__oak_js_break=null){return ((evt)=>((evt=input()),__oak_push(file,(evt.data??null)),((__oak_cond)=>__oak_eq(__oak_cond,Symbol.for('error'))?__oak_js_break(file):__oak_push(file,__Oak_String(`
`)))((evt.type??null))))()})))()},println=function println(...xs){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?print(__Oak_String(`
`)):((out)=>((out=reduce(slice(xs,1),string(__oak_acc(xs,0)),function _(acc=null,x=null){return (__as_oak_string(__as_oak_string(acc+__Oak_String(` `))+string(x)))})),print(__as_oak_string(out+__Oak_String(`
`)))))())(len(xs))},({_asPredicate,_baseIterator,_hToN,_nToH,append,clamp,clone,compact,contains__oak_qm,debounce,__oak_js_default,each,entries,every,filter,find,first,flatten,fromHex,identity,indexOf,join,last,loop,map,merge,once,partition,println,range,reduce,reverse,slice,some,stdin,take,takeLast,toHex,uniq,values,zip})))()}),__oak_modularize(__Oak_String(`str`),function _(){return ((_extend,_matchesAt__oak_qm,_replaceNonEmpty,_splitNonEmpty,_trimEndNonEmpty,_trimEndSpace,_trimStartNonEmpty,_trimStartSpace,checkRange,contains__oak_qm,cut,__oak_js_default,digit__oak_qm,endsWith__oak_qm,indexOf,join,letter__oak_qm,lower,lower__oak_qm,padEnd,padStart,reduce,replace,slice,space__oak_qm,split,startsWith__oak_qm,take,takeLast,trim,trimEnd,trimStart,upper,upper__oak_qm,word__oak_qm)=>(({__oak_js_default,slice,take,takeLast,reduce}=__oak_module_import(__Oak_String(`std`))),checkRange=function checkRange(lo=null,hi=null){let checker;return checker=function checker(c=null){return ((p)=>((p=codepoint(c)),(__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(p<=hi)))((lo<=p))))()}},upper__oak_qm=function upper__oak_qm(c=null){return (__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(c<=__Oak_String(`Z`))))((c>=__Oak_String(`A`)))},lower__oak_qm=function lower__oak_qm(c=null){return (__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(c<=__Oak_String(`z`))))((c>=__Oak_String(`a`)))},digit__oak_qm=function digit__oak_qm(c=null){return (__oak_left=>__oak_left===false?false:__oak_and(__oak_left,(c<=__Oak_String(`9`))))((c>=__Oak_String(`0`)))},space__oak_qm=function space__oak_qm(c=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(` `))?true:__oak_eq(__oak_cond,__Oak_String(`	`))?true:__oak_eq(__oak_cond,__Oak_String(`
`))?true:__oak_eq(__oak_cond,__Oak_String(``))?true:__oak_eq(__oak_cond,__Oak_String(``))?true:false)(c)},letter__oak_qm=function letter__oak_qm(c=null){return (__oak_left=>__oak_left===true?true:__oak_or(__oak_left,lower__oak_qm(c)))(upper__oak_qm(c))},word__oak_qm=function word__oak_qm(c=null){return (__oak_left=>__oak_left===true?true:__oak_or(__oak_left,digit__oak_qm(c)))(letter__oak_qm(c))},join=function join(strings=null,joiner=null){return ((joiner=__oak_js_default(joiner,__Oak_String(``))),((__oak_cond)=>__oak_eq(__oak_cond,0)?__Oak_String(``):reduce(slice(strings,1),__oak_acc(strings,0),function _(a=null,b=null){return __as_oak_string(__as_oak_string(a+joiner)+b)}))(len(strings)))},startsWith__oak_qm=function startsWith__oak_qm(s=null,prefix=null){return __oak_eq(take(s,len(prefix)),prefix)},endsWith__oak_qm=function endsWith__oak_qm(s=null,suffix=null){return __oak_eq(takeLast(s,len(suffix)),suffix)},_matchesAt__oak_qm=function _matchesAt__oak_qm(s=null,substr=null,idx=null){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?true:__oak_eq(__oak_cond,1)?__oak_eq(__oak_acc(s,__oak_obj_key((idx))),substr):((max,sub)=>((max=len(substr)),sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,max)?true:((__oak_cond)=>__oak_eq(__oak_cond,__oak_acc(substr,__oak_obj_key((i))))?__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)):false)(__oak_acc(s,__oak_obj_key((__as_oak_string(idx+i))))))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub(0)))())(len(substr))},indexOf=function indexOf(s=null,substr=null){return ((max,sub)=>((max=(len(s)-len(substr))),sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?i:((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+1)):-1)((i<max)))(_matchesAt__oak_qm(s,substr,i))}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},sub(0)))()},contains__oak_qm=function contains__oak_qm(s=null,substr=null){return (indexOf(s,substr)>=0)},cut=function cut(s=null,sep=null){let idx;return ((__oak_cond)=>__oak_eq(__oak_cond,-1)?[s,__Oak_String(``)]:[slice(s,0,idx),slice(s,__as_oak_string(idx+len(sep)))])((idx=indexOf(s,sep)))},lower=function lower(s=null){return reduce(s,__Oak_String(``),function _(acc=null,c=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_push(acc,char(__as_oak_string(codepoint(c)+32))):__oak_push(acc,c))(upper__oak_qm(c))})},upper=function upper(s=null){return reduce(s,__Oak_String(``),function _(acc=null,c=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_push(acc,char((codepoint(c)-32))):__oak_push(acc,c))(lower__oak_qm(c))})},_replaceNonEmpty=function _replaceNonEmpty(s=null,old=null,__oak_js_new=null){return ((lnew,lold,sub)=>((lold=len(old)),(lnew=len(__oak_js_new)),sub=function sub(acc=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_trampoline(__oak_trampolined_sub,__as_oak_string(__as_oak_string(slice(acc,0,i)+__oak_js_new)+slice(acc,__as_oak_string(i+lold))),__as_oak_string(i+lnew)):((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_trampoline(__oak_trampolined_sub,acc,__as_oak_string(i+1)):acc)((i<len(acc))))(_matchesAt__oak_qm(acc,old,i))}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i)))()},sub(s,0)))()},replace=function replace(s=null,old=null,__oak_js_new=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(``))?s:_replaceNonEmpty(s,old,__oak_js_new))(old)},_splitNonEmpty=function _splitNonEmpty(s=null,sep=null){return ((coll,lsep,sub)=>((coll=[]),(lsep=len(sep)),sub=function sub(acc=null,i=null,last=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(acc=null,i=null,last=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?(__oak_push(coll,slice(acc,last,i)),__oak_trampoline(__oak_trampolined_sub,acc,__as_oak_string(i+lsep),__as_oak_string(i+lsep))):((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_trampoline(__oak_trampolined_sub,acc,__as_oak_string(i+1),last):__oak_push(coll,slice(acc,last)))((i<len(acc))))(_matchesAt__oak_qm(acc,sep,i))}),__oak_resolve_trampoline(__oak_trampolined_sub,acc,i,last)))()},sub(s,0,0)))()},split=function split(s=null,sep=null){return ((__oak_cond)=>__oak_eq(__oak_cond,null)?reduce(s,[],function _(acc=null,c=null){return __oak_push(acc,c)}):__oak_eq(__oak_cond,__Oak_String(``))?reduce(s,[],function _(acc=null,c=null){return __oak_push(acc,c)}):_splitNonEmpty(s,sep))(sep)},_extend=function _extend(pad=null,n=null){return ((part,sub,times)=>((times=int((n/len(pad)))),(part=(n%len(pad))),sub=function sub(base=null,i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(base=null,i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,0)?__oak_push(base,slice(pad,0,part)):__oak_trampoline(__oak_trampolined_sub,__oak_push(base,pad),(i-1)))(i)}),__oak_resolve_trampoline(__oak_trampolined_sub,base,i)))()},sub(__Oak_String(``),times)))()},padStart=function padStart(s=null,n=null,pad=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?s:__oak_push(_extend(pad,(n-len(s))),s))((len(s)>=n))},padEnd=function padEnd(s=null,n=null,pad=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?s:__as_oak_string(s+_extend(pad,(n-len(s)))))((len(s)>=n))},_trimStartSpace=function _trimStartSpace(s=null){return ((firstNonSpace,subStart)=>(subStart=function subStart(i=null){return ((__oak_trampolined_subStart)=>((__oak_trampolined_subStart=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_trampoline(__oak_trampolined_subStart,__as_oak_string(i+1)):i)(space__oak_qm(__oak_acc(s,__oak_obj_key((i)))))}),__oak_resolve_trampoline(__oak_trampolined_subStart,i)))()},(firstNonSpace=subStart(0)),slice(s,firstNonSpace)))()},_trimStartNonEmpty=function _trimStartNonEmpty(s=null,prefix=null){return ((idx,lpref,max,sub)=>((max=len(s)),(lpref=len(prefix)),sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_trampoline(__oak_trampolined_sub,__as_oak_string(i+lpref)):i)(_matchesAt__oak_qm(s,prefix,i)):i)((i<max))}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},(idx=sub(0)),slice(s,idx)))()},trimStart=function trimStart(s=null,prefix=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(``))?s:__oak_eq(__oak_cond,null)?_trimStartSpace(s):_trimStartNonEmpty(s,prefix))(prefix)},_trimEndSpace=function _trimEndSpace(s=null){return ((lastNonSpace,subEnd)=>(subEnd=function subEnd(i=null){return ((__oak_trampolined_subEnd)=>((__oak_trampolined_subEnd=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_trampoline(__oak_trampolined_subEnd,(i-1)):i)(space__oak_qm(__oak_acc(s,__oak_obj_key((i)))))}),__oak_resolve_trampoline(__oak_trampolined_subEnd,i)))()},(lastNonSpace=subEnd((len(s)-1))),slice(s,0,__as_oak_string(lastNonSpace+1))))()},_trimEndNonEmpty=function _trimEndNonEmpty(s=null,suffix=null){return ((idx,lsuf,sub)=>((lsuf=len(suffix)),sub=function sub(i=null){return ((__oak_trampolined_sub)=>((__oak_trampolined_sub=function _(i=null){return ((__oak_cond)=>__oak_eq(__oak_cond,true)?((__oak_cond)=>__oak_eq(__oak_cond,true)?__oak_trampoline(__oak_trampolined_sub,(i-lsuf)):i)(_matchesAt__oak_qm(s,suffix,(i-lsuf))):i)((i>-1))}),__oak_resolve_trampoline(__oak_trampolined_sub,i)))()},(idx=sub(len(s))),slice(s,0,idx)))()},trimEnd=function trimEnd(s=null,suffix=null){return ((__oak_cond)=>__oak_eq(__oak_cond,__Oak_String(``))?s:__oak_eq(__oak_cond,null)?_trimEndSpace(s):_trimEndNonEmpty(s,suffix))(suffix)},trim=function trim(s=null,part=null){return trimEnd(trimStart(s,part),part)},({_extend,_matchesAt__oak_qm,_replaceNonEmpty,_splitNonEmpty,_trimEndNonEmpty,_trimEndSpace,_trimStartNonEmpty,_trimStartSpace,checkRange,contains__oak_qm,cut,__oak_js_default,digit__oak_qm,endsWith__oak_qm,indexOf,join,letter__oak_qm,lower,lower__oak_qm,padEnd,padStart,reduce,replace,slice,space__oak_qm,split,startsWith__oak_qm,take,takeLast,trim,trimEnd,trimStart,upper,upper__oak_qm,word__oak_qm})))()}),(__Oak_Import_Aliases=({})),__oak_module_import(__Oak_String(`web/entry.oak`)))


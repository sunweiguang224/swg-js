(function(){

/*
 Sizzle框架
 函数介绍：
 var Sizzle = function( selector, context, results, seed ){}
 Sizzle有四个参数：
 　　selector	：选择表达式
 　　context	：上下文
 　　results	：结果集
 　　seed	：候选集
 实例说明：
 Sizzle('div',#test,[#a,#b],[#c,#d,#e])就是在集合[#c,#d,#e]中查找满足条件（在#test范围中并标签名为div）的元素，然后将满足条件的结果存入[#a,#b]中，假设满足条件的有#d,#e，最后获得就是[#a,#b,#d,#e]。
 * */

/*!
 * Sizzle CSS Selector Engine v2.3.4-pre
 * https://sizzlejs.com/
 *
 * Copyright jQuery Foundation and other contributors
 * Released under the MIT license
 * http://jquery.org/license
 *
 * Date: 2016-08-08
 */
var Sizzle = (function( window ) {

var i,
	support,
	Expr,
	getText,
	isXML,
	tokenize,
	compile,
	select,
	outermostContext,
	sortInput,
	hasDuplicate,

	// Local document vars
	setDocument,
	document,
	docElem,
	documentIsHTML,
	rbuggyQSA,
	rbuggyMatches,
	matches,
	contains,

	// Instance-specific data
	expando = "sizzle" + 1 * new Date(),
	preferredDoc = window.document,
	dirruns = 0,
	done = 0,
	classCache = createCache(),
	tokenCache = createCache(),
	compilerCache = createCache(),
	sortOrder = function( a, b ) {
		if ( a === b ) {
			hasDuplicate = true;
		}
		return 0;
	},

	// Instance methods
	hasOwn = ({}).hasOwnProperty,
	arr = [],
	pop = arr.pop,
	push_native = arr.push,
	push = arr.push,
	slice = arr.slice,
	// Use a stripped-down indexOf as it's faster than native
	// https://jsperf.com/thor-indexof-vs-for/5
	indexOf = function( list, elem ) {
		var i = 0,
			len = list.length;
		for ( ; i < len; i++ ) {
			if ( list[i] === elem ) {
				return i;
			}
		}
		return -1;
	},

	booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",

	// Regular expressions

	// http://www.w3.org/TR/css3-selectors/#whitespace
	whitespace = "[\\x20\\t\\r\\n\\f]",

	// http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
	identifier = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+",

	// Attribute selectors: http://www.w3.org/TR/selectors/#attribute-selectors
	attributes = "\\[" + whitespace + "*(" + identifier + ")(?:" + whitespace +
		// Operator (capture 2)
		"*([*^$|!~]?=)" + whitespace +
		// "Attribute values must be CSS identifiers [capture 5] or strings [capture 3 or capture 4]"
		"*(?:'((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\"|(" + identifier + "))|)" + whitespace +
		"*\\]",

	pseudos = ":(" + identifier + ")(?:\\((" +
		// To reduce the number of selectors needing tokenize in the preFilter, prefer arguments:
		// 1. quoted (capture 3; capture 4 or capture 5)
		"('((?:\\\\.|[^\\\\'])*)'|\"((?:\\\\.|[^\\\\\"])*)\")|" +
		// 2. simple (capture 6)
		"((?:\\\\.|[^\\\\()[\\]]|" + attributes + ")*)|" +
		// 3. anything else (capture 2)
		".*" +
		")\\)|)",

	// Leading and non-escaped trailing whitespace, capturing some non-whitespace characters preceding the latter
	rwhitespace = new RegExp( whitespace + "+", "g" ),
	rtrim = new RegExp( "^" + whitespace + "+|((?:^|[^\\\\])(?:\\\\.)*)" + whitespace + "+$", "g" ),

	rcomma = new RegExp( "^" + whitespace + "*," + whitespace + "*" ),
	rcombinators = new RegExp( "^" + whitespace + "*([>+~]|" + whitespace + ")" + whitespace + "*" ),

	rattributeQuotes = new RegExp( "=" + whitespace + "*([^\\]'\"]*?)" + whitespace + "*\\]", "g" ),

	rpseudo = new RegExp( pseudos ),
	ridentifier = new RegExp( "^" + identifier + "$" ),

	matchExpr = {
		"ID": new RegExp( "^#(" + identifier + ")" ),
		"CLASS": new RegExp( "^\\.(" + identifier + ")" ),
		"TAG": new RegExp( "^(" + identifier + "|[*])" ),
		"ATTR": new RegExp( "^" + attributes ),
		"PSEUDO": new RegExp( "^" + pseudos ),
		"CHILD": new RegExp( "^:(only|first|last|nth|nth-last)-(child|of-type)(?:\\(" + whitespace +
			"*(even|odd|(([+-]|)(\\d*)n|)" + whitespace + "*(?:([+-]|)" + whitespace +
			"*(\\d+)|))" + whitespace + "*\\)|)", "i" ),
		"bool": new RegExp( "^(?:" + booleans + ")$", "i" ),
		// For use in libraries implementing .is()
		// We use this for POS matching in `select`
		"needsContext": new RegExp( "^" + whitespace + "*[>+~]|:(even|odd|eq|gt|lt|nth|first|last)(?:\\(" +
			whitespace + "*((?:-\\d)?\\d*)" + whitespace + "*\\)|)(?=[^-]|$)", "i" )
	},

	rinputs = /^(?:input|select|textarea|button)$/i,
	rheader = /^h\d$/i,

	rnative = /^[^{]+\{\s*\[native \w/,

	// Easily-parseable/retrievable ID or TAG or CLASS selectors
	rquickExpr = /^(?:#([\w-]+)|(\w+)|\.([\w-]+))$/,

	rsibling = /[+~]/,

	// CSS escapes
	// http://www.w3.org/TR/CSS21/syndata.html#escaped-characters
	runescape = new RegExp( "\\\\([\\da-f]{1,6}" + whitespace + "?|(" + whitespace + ")|.)", "ig" ),
	funescape = function( _, escaped, escapedWhitespace ) {
		var high = "0x" + escaped - 0x10000;
		// NaN means non-codepoint
		// Support: Firefox<24
		// Workaround erroneous numeric interpretation of +"0x"
		return high !== high || escapedWhitespace ?
			escaped :
			high < 0 ?
				// BMP codepoint
				String.fromCharCode( high + 0x10000 ) :
				// Supplemental Plane codepoint (surrogate pair)
				String.fromCharCode( high >> 10 | 0xD800, high & 0x3FF | 0xDC00 );
	},

	// CSS string/identifier serialization
	// https://drafts.csswg.org/cssom/#common-serializing-idioms
	rcssescape = /([\0-\x1f\x7f]|^-?\d)|^-$|[^\0-\x1f\x7f-\uFFFF\w-]/g,
	fcssescape = function( ch, asCodePoint ) {
		if ( asCodePoint ) {

			// U+0000 NULL becomes U+FFFD REPLACEMENT CHARACTER
			if ( ch === "\0" ) {
				return "\uFFFD";
			}

			// Control characters and (dependent upon position) numbers get escaped as code points
			return ch.slice( 0, -1 ) + "\\" + ch.charCodeAt( ch.length - 1 ).toString( 16 ) + " ";
		}

		// Other potentially-special ASCII characters get backslash-escaped
		return "\\" + ch;
	},

	// Used for iframes
	// See setDocument()
	// Removing the function wrapper causes a "Permission Denied"
	// error in IE
	unloadHandler = function() {
		setDocument();
	},

	disabledAncestor = addCombinator(
		function( elem ) {
			return elem.disabled === true && ("form" in elem || "label" in elem);
		},
		{ dir: "parentNode", next: "legend" }
	);

// Optimize for push.apply( _, NodeList )
try {
	push.apply(
		(arr = slice.call( preferredDoc.childNodes )),
		preferredDoc.childNodes
	);
	// Support: Android<4.0
	// Detect silently failing push.apply
	arr[ preferredDoc.childNodes.length ].nodeType;
} catch ( e ) {
	push = { apply: arr.length ?

		// Leverage slice if possible
		function( target, els ) {
			push_native.apply( target, slice.call(els) );
		} :

		// Support: IE<9
		// Otherwise append directly
		function( target, els ) {
			var j = target.length,
				i = 0;
			// Can't trust NodeList.length
			while ( (target[j++] = els[i++]) ) {}
			target.length = j - 1;
		}
	};
}

function Sizzle( selector, context, results, seed ) {
	var m, i, elem, nid, match, groups, newSelector,
		newContext = context && context.ownerDocument,

		// nodeType defaults to 9, since context defaults to document
		nodeType = context ? context.nodeType : 9;

	results = results || [];

	// Return early from calls with invalid selector or context
	if ( typeof selector !== "string" || !selector ||
		nodeType !== 1 && nodeType !== 9 && nodeType !== 11 ) {

		return results;
	}

	// Try to shortcut find operations (as opposed to filters) in HTML documents
	if ( !seed ) {

		if ( ( context ? context.ownerDocument || context : preferredDoc ) !== document ) {
			setDocument( context );
		}
		context = context || document;

		if ( documentIsHTML ) {

			// If the selector is sufficiently simple, try using a "get*By*" DOM method
			// (excepting DocumentFragment context, where the methods don't exist)
			if ( nodeType !== 11 && (match = rquickExpr.exec( selector )) ) {

				// ID selector
				if ( (m = match[1]) ) {

					// Document context
					if ( nodeType === 9 ) {
						if ( (elem = context.getElementById( m )) ) {

							// Support: IE, Opera, Webkit
							// TODO: identify versions
							// getElementById can match elements by name instead of ID
							if ( elem.id === m ) {
								results.push( elem );
								return results;
							}
						} else {
							return results;
						}

					// Element context
					} else {

						// Support: IE, Opera, Webkit
						// TODO: identify versions
						// getElementById can match elements by name instead of ID
						if ( newContext && (elem = newContext.getElementById( m )) &&
							contains( context, elem ) &&
							elem.id === m ) {

							results.push( elem );
							return results;
						}
					}

				// Type selector
				} else if ( match[2] ) {
					push.apply( results, context.getElementsByTagName( selector ) );
					return results;

				// Class selector
				} else if ( (m = match[3]) && support.getElementsByClassName &&
					context.getElementsByClassName ) {

					push.apply( results, context.getElementsByClassName( m ) );
					return results;
				}
			}

			// Take advantage of querySelectorAll
			if ( support.qsa &&
				!compilerCache[ selector + " " ] &&
				(!rbuggyQSA || !rbuggyQSA.test( selector )) ) {

				if ( nodeType !== 1 ) {
					newContext = context;
					newSelector = selector;

				// qSA looks outside Element context, which is not what we want
				// Thanks to Andrew Dupont for this workaround technique
				// Support: IE <=8
				// Exclude object elements
				} else if ( context.nodeName.toLowerCase() !== "object" ) {

					// Capture the context ID, setting it first if necessary
					if ( (nid = context.getAttribute( "id" )) ) {
						nid = nid.replace( rcssescape, fcssescape );
					} else {
						context.setAttribute( "id", (nid = expando) );
					}

					// Prefix every selector in the list
					groups = tokenize( selector );
					i = groups.length;
					while ( i-- ) {
						groups[i] = "#" + nid + " " + toSelector( groups[i] );
					}
					newSelector = groups.join( "," );

					// Expand context for sibling selectors
					newContext = rsibling.test( selector ) && testContext( context.parentNode ) ||
						context;
				}

				if ( newSelector ) {
					try {
						push.apply( results,
							newContext.querySelectorAll( newSelector )
						);
						return results;
					} catch ( qsaError ) {
					} finally {
						if ( nid === expando ) {
							context.removeAttribute( "id" );
						}
					}
				}
			}
		}
	}

	// All others
	return select( selector.replace( rtrim, "$1" ), context, results, seed );
}

/**
 * Create key-value caches of limited size
 * @returns {function(string, object)} Returns the Object data after storing it on itself with
 *	property name the (space-suffixed) string and (if the cache is larger than Expr.cacheLength)
 *	deleting the oldest entry
 */
function createCache() {
	var keys = [];

	function cache( key, value ) {
		// Use (key + " ") to avoid collision with native prototype properties (see Issue #157)
		if ( keys.push( key + " " ) > Expr.cacheLength ) {
			// Only keep the most recent entries
			delete cache[ keys.shift() ];
		}
		return (cache[ key + " " ] = value);
	}
	return cache;
}

/**
 * Mark a function for special use by Sizzle
 * @param {Function} fn The function to mark
 */
function markFunction( fn ) {
	fn[ expando ] = true;
	return fn;
}

/**
 * Support testing using an element
 * @param {Function} fn Passed the created element and returns a boolean result
 */
function assert( fn ) {
	var el = document.createElement("fieldset");

	try {
		return !!fn( el );
	} catch (e) {
		return false;
	} finally {
		// Remove from its parent by default
		if ( el.parentNode ) {
			el.parentNode.removeChild( el );
		}
		// release memory in IE
		el = null;
	}
}

/**
 * Adds the same handler for all of the specified attrs
 * @param {String} attrs Pipe-separated list of attributes
 * @param {Function} handler The method that will be applied
 */
function addHandle( attrs, handler ) {
	var arr = attrs.split("|"),
		i = arr.length;

	while ( i-- ) {
		Expr.attrHandle[ arr[i] ] = handler;
	}
}

/**
 * Checks document order of two siblings
 * @param {Element} a
 * @param {Element} b
 * @returns {Number} Returns less than 0 if a precedes b, greater than 0 if a follows b
 */
function siblingCheck( a, b ) {
	var cur = b && a,
		diff = cur && a.nodeType === 1 && b.nodeType === 1 &&
			a.sourceIndex - b.sourceIndex;

	// Use IE sourceIndex if available on both nodes
	if ( diff ) {
		return diff;
	}

	// Check if b follows a
	if ( cur ) {
		while ( (cur = cur.nextSibling) ) {
			if ( cur === b ) {
				return -1;
			}
		}
	}

	return a ? 1 : -1;
}

/**
 * Returns a function to use in pseudos for input types
 * @param {String} type
 */
function createInputPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return name === "input" && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for buttons
 * @param {String} type
 */
function createButtonPseudo( type ) {
	return function( elem ) {
		var name = elem.nodeName.toLowerCase();
		return (name === "input" || name === "button") && elem.type === type;
	};
}

/**
 * Returns a function to use in pseudos for :enabled/:disabled
 * @param {Boolean} disabled true for :disabled; false for :enabled
 */
function createDisabledPseudo( disabled ) {

	// Known :disabled false positives: fieldset[disabled] > legend:nth-of-type(n+2) :can-disable
	return function( elem ) {

		// Only certain elements can match :enabled or :disabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-enabled
		// https://html.spec.whatwg.org/multipage/scripting.html#selector-disabled
		if ( "form" in elem ) {

			// Check for inherited disabledness on relevant non-disabled elements:
			// * listed form-associated elements in a disabled fieldset
			//   https://html.spec.whatwg.org/multipage/forms.html#category-listed
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-fe-disabled
			// * option elements in a disabled optgroup
			//   https://html.spec.whatwg.org/multipage/forms.html#concept-option-disabled
			// All such elements have a "form" property.
			if ( elem.parentNode && elem.disabled === false ) {

				// Option elements defer to a parent optgroup if present
				if ( "label" in elem ) {
					if ( "label" in elem.parentNode ) {
						return elem.parentNode.disabled === disabled;
					} else {
						return elem.disabled === disabled;
					}
				}

				// Support: IE 6 - 11
				// Use the isDisabled shortcut property to check for disabled fieldset ancestors
				return elem.isDisabled === disabled ||

					// Where there is no isDisabled, check manually
					/* jshint -W018 */
					elem.isDisabled !== !disabled &&
						disabledAncestor( elem ) === disabled;
			}

			return elem.disabled === disabled;

		// Try to winnow out elements that can't be disabled before trusting the disabled property.
		// Some victims get caught in our net (label, legend, menu, track), but it shouldn't
		// even exist on them, let alone have a boolean value.
		} else if ( "label" in elem ) {
			return elem.disabled === disabled;
		}

		// Remaining elements are neither :enabled nor :disabled
		return false;
	};
}

/**
 * Returns a function to use in pseudos for positionals
 * @param {Function} fn
 */
function createPositionalPseudo( fn ) {
	return markFunction(function( argument ) {
		argument = +argument;
		return markFunction(function( seed, matches ) {
			var j,
				matchIndexes = fn( [], seed.length, argument ),
				i = matchIndexes.length;

			// Match elements found at the specified indexes
			while ( i-- ) {
				if ( seed[ (j = matchIndexes[i]) ] ) {
					seed[j] = !(matches[j] = seed[j]);
				}
			}
		});
	});
}

/**
 * Checks a node for validity as a Sizzle context
 * @param {Element|Object=} context
 * @returns {Element|Object|Boolean} The input node if acceptable, otherwise a falsy value
 */
function testContext( context ) {
	return context && typeof context.getElementsByTagName !== "undefined" && context;
}

// Expose support vars for convenience
support = Sizzle.support = {};

/**
 * Detects XML nodes
 * @param {Element|Object} elem An element or a document
 * @returns {Boolean} True iff elem is a non-HTML XML node
 */
isXML = Sizzle.isXML = function( elem ) {
	// documentElement is verified for cases where it doesn't yet exist
	// (such as loading iframes in IE - #4833)
	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
	return documentElement ? documentElement.nodeName !== "HTML" : false;
};

/**
 * Sets document-related variables once based on the current document
 * @param {Element|Object} [doc] An element or document object to use to set the document
 * @returns {Object} Returns the current document
 */
setDocument = Sizzle.setDocument = function( node ) {
	var hasCompare, subWindow,
		doc = node ? node.ownerDocument || node : preferredDoc;

	// Return early if doc is invalid or already selected
	if ( doc === document || doc.nodeType !== 9 || !doc.documentElement ) {
		return document;
	}

	// Update global variables
	document = doc;
	docElem = document.documentElement;
	documentIsHTML = !isXML( document );

	// Support: IE 9-11, Edge
	// Accessing iframe documents after unload throws "permission denied" errors (jQuery #13936)
	if ( preferredDoc !== document &&
		(subWindow = document.defaultView) && subWindow.top !== subWindow ) {

		// Support: IE 11, Edge
		if ( subWindow.addEventListener ) {
			subWindow.addEventListener( "unload", unloadHandler, false );

		// Support: IE 9 - 10 only
		} else if ( subWindow.attachEvent ) {
			subWindow.attachEvent( "onunload", unloadHandler );
		}
	}

	/* Attributes
	---------------------------------------------------------------------- */

	// Support: IE<8
	// Verify that getAttribute really returns attributes and not properties
	// (excepting IE8 booleans)
	support.attributes = assert(function( el ) {
		el.className = "i";
		return !el.getAttribute("className");
	});

	/* getElement(s)By*
	---------------------------------------------------------------------- */

	// Check if getElementsByTagName("*") returns only elements
	support.getElementsByTagName = assert(function( el ) {
		el.appendChild( document.createComment("") );
		return !el.getElementsByTagName("*").length;
	});

	// Support: IE<9
	support.getElementsByClassName = rnative.test( document.getElementsByClassName );

	// Support: IE<10
	// Check if getElementById returns elements by name
	// The broken getElementById methods don't pick up programmatically-set names,
	// so use a roundabout getElementsByName test
	support.getById = assert(function( el ) {
		docElem.appendChild( el ).id = expando;
		return !document.getElementsByName || !document.getElementsByName( expando ).length;
	});

	// ID filter and find
	if ( support.getById ) {
		Expr.filter["ID"] = function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				return elem.getAttribute("id") === attrId;
			};
		};
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var elem = context.getElementById( id );
				return elem ? [ elem ] : [];
			}
		};
	} else {
		Expr.filter["ID"] =  function( id ) {
			var attrId = id.replace( runescape, funescape );
			return function( elem ) {
				var node = typeof elem.getAttributeNode !== "undefined" &&
					elem.getAttributeNode("id");
				return node && node.value === attrId;
			};
		};

		// Support: IE 6 - 7 only
		// getElementById is not reliable as a find shortcut
		Expr.find["ID"] = function( id, context ) {
			if ( typeof context.getElementById !== "undefined" && documentIsHTML ) {
				var node, i, elems,
					elem = context.getElementById( id );

				if ( elem ) {

					// Verify the id attribute
					node = elem.getAttributeNode("id");
					if ( node && node.value === id ) {
						return [ elem ];
					}

					// Fall back on getElementsByName
					elems = context.getElementsByName( id );
					i = 0;
					while ( (elem = elems[i++]) ) {
						node = elem.getAttributeNode("id");
						if ( node && node.value === id ) {
							return [ elem ];
						}
					}
				}

				return [];
			}
		};
	}

	// Tag
	Expr.find["TAG"] = support.getElementsByTagName ?
		function( tag, context ) {
			if ( typeof context.getElementsByTagName !== "undefined" ) {
				return context.getElementsByTagName( tag );

			// DocumentFragment nodes don't have gEBTN
			} else if ( support.qsa ) {
				return context.querySelectorAll( tag );
			}
		} :

		function( tag, context ) {
			var elem,
				tmp = [],
				i = 0,
				// By happy coincidence, a (broken) gEBTN appears on DocumentFragment nodes too
				results = context.getElementsByTagName( tag );

			// Filter out possible comments
			if ( tag === "*" ) {
				while ( (elem = results[i++]) ) {
					if ( elem.nodeType === 1 ) {
						tmp.push( elem );
					}
				}

				return tmp;
			}
			return results;
		};

	// Class
	Expr.find["CLASS"] = support.getElementsByClassName && function( className, context ) {
		if ( typeof context.getElementsByClassName !== "undefined" && documentIsHTML ) {
			return context.getElementsByClassName( className );
		}
	};

	/* QSA/matchesSelector
	---------------------------------------------------------------------- */

	// QSA and matchesSelector support

	// matchesSelector(:active) reports false when true (IE9/Opera 11.5)
	rbuggyMatches = [];

	// qSa(:focus) reports false when true (Chrome 21)
	// We allow this because of a bug in IE8/9 that throws an error
	// whenever `document.activeElement` is accessed on an iframe
	// So, we allow :focus to pass through QSA all the time to avoid the IE error
	// See https://bugs.jquery.com/ticket/13378
	rbuggyQSA = [];

	if ( (support.qsa = rnative.test( document.querySelectorAll )) ) {
		// Build QSA regex
		// Regex strategy adopted from Diego Perini
		assert(function( el ) {
			// Select is set to empty string on purpose
			// This is to test IE's treatment of not explicitly
			// setting a boolean content attribute,
			// since its presence should be enough
			// https://bugs.jquery.com/ticket/12359
			docElem.appendChild( el ).innerHTML = "<a id='" + expando + "'></a>" +
				"<select id='" + expando + "-\r\\' msallowcapture=''>" +
				"<option selected=''></option></select>";

			// Support: IE8, Opera 11-12.16
			// Nothing should be selected when empty strings follow ^= or $= or *=
			// The test attribute must be unknown in Opera but "safe" for WinRT
			// https://msdn.microsoft.com/en-us/library/ie/hh465388.aspx#attribute_section
			if ( el.querySelectorAll("[msallowcapture^='']").length ) {
				rbuggyQSA.push( "[*^$]=" + whitespace + "*(?:''|\"\")" );
			}

			// Support: IE8
			// Boolean attributes and "value" are not treated correctly
			if ( !el.querySelectorAll("[selected]").length ) {
				rbuggyQSA.push( "\\[" + whitespace + "*(?:value|" + booleans + ")" );
			}

			// Support: Chrome<29, Android<4.4, Safari<7.0+, iOS<7.0+, PhantomJS<1.9.8+
			if ( !el.querySelectorAll( "[id~=" + expando + "-]" ).length ) {
				rbuggyQSA.push("~=");
			}

			// Webkit/Opera - :checked should return selected option elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			// IE8 throws error here and will not see later tests
			if ( !el.querySelectorAll(":checked").length ) {
				rbuggyQSA.push(":checked");
			}

			// Support: Safari 8+, iOS 8+
			// https://bugs.webkit.org/show_bug.cgi?id=136851
			// In-page `selector#id sibling-combinator selector` fails
			if ( !el.querySelectorAll( "a#" + expando + "+*" ).length ) {
				rbuggyQSA.push(".#.+[+~]");
			}
		});

		assert(function( el ) {
			el.innerHTML = "<a href='' disabled='disabled'></a>" +
				"<select disabled='disabled'><option/></select>";

			// Support: Windows 8 Native Apps
			// The type and name attributes are restricted during .innerHTML assignment
			var input = document.createElement("input");
			input.setAttribute( "type", "hidden" );
			el.appendChild( input ).setAttribute( "name", "D" );

			// Support: IE8
			// Enforce case-sensitivity of name attribute
			if ( el.querySelectorAll("[name=d]").length ) {
				rbuggyQSA.push( "name" + whitespace + "*[*^$|!~]?=" );
			}

			// FF 3.5 - :enabled/:disabled and hidden elements (hidden elements are still enabled)
			// IE8 throws error here and will not see later tests
			if ( el.querySelectorAll(":enabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Support: IE9-11+
			// IE's :disabled selector does not pick up the children of disabled fieldsets
			docElem.appendChild( el ).disabled = true;
			if ( el.querySelectorAll(":disabled").length !== 2 ) {
				rbuggyQSA.push( ":enabled", ":disabled" );
			}

			// Opera 10-11 does not throw on post-comma invalid pseudos
			el.querySelectorAll("*,:x");
			rbuggyQSA.push(",.*:");
		});
	}

	if ( (support.matchesSelector = rnative.test( (matches = docElem.matches ||
		docElem.webkitMatchesSelector ||
		docElem.mozMatchesSelector ||
		docElem.oMatchesSelector ||
		docElem.msMatchesSelector) )) ) {

		assert(function( el ) {
			// Check to see if it's possible to do matchesSelector
			// on a disconnected node (IE 9)
			support.disconnectedMatch = matches.call( el, "*" );

			// This should fail with an exception
			// Gecko does not error, returns false instead
			matches.call( el, "[s!='']:x" );
			rbuggyMatches.push( "!=", pseudos );
		});
	}

	rbuggyQSA = rbuggyQSA.length && new RegExp( rbuggyQSA.join("|") );
	rbuggyMatches = rbuggyMatches.length && new RegExp( rbuggyMatches.join("|") );

	/* Contains
	---------------------------------------------------------------------- */
	hasCompare = rnative.test( docElem.compareDocumentPosition );

	// Element contains another
	// Purposefully self-exclusive
	// As in, an element does not contain itself
	contains = hasCompare || rnative.test( docElem.contains ) ?
		function( a, b ) {
			var adown = a.nodeType === 9 ? a.documentElement : a,
				bup = b && b.parentNode;
			return a === bup || !!( bup && bup.nodeType === 1 && (
				adown.contains ?
					adown.contains( bup ) :
					a.compareDocumentPosition && a.compareDocumentPosition( bup ) & 16
			));
		} :
		function( a, b ) {
			if ( b ) {
				while ( (b = b.parentNode) ) {
					if ( b === a ) {
						return true;
					}
				}
			}
			return false;
		};

	/* Sorting
	---------------------------------------------------------------------- */

	// Document order sorting
	sortOrder = hasCompare ?
	function( a, b ) {

		// Flag for duplicate removal
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		// Sort on method existence if only one input has compareDocumentPosition
		var compare = !a.compareDocumentPosition - !b.compareDocumentPosition;
		if ( compare ) {
			return compare;
		}

		// Calculate position if both inputs belong to the same document
		compare = ( a.ownerDocument || a ) === ( b.ownerDocument || b ) ?
			a.compareDocumentPosition( b ) :

			// Otherwise we know they are disconnected
			1;

		// Disconnected nodes
		if ( compare & 1 ||
			(!support.sortDetached && b.compareDocumentPosition( a ) === compare) ) {

			// Choose the first element that is related to our preferred document
			if ( a === document || a.ownerDocument === preferredDoc && contains(preferredDoc, a) ) {
				return -1;
			}
			if ( b === document || b.ownerDocument === preferredDoc && contains(preferredDoc, b) ) {
				return 1;
			}

			// Maintain original order
			return sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;
		}

		return compare & 4 ? -1 : 1;
	} :
	function( a, b ) {
		// Exit early if the nodes are identical
		if ( a === b ) {
			hasDuplicate = true;
			return 0;
		}

		var cur,
			i = 0,
			aup = a.parentNode,
			bup = b.parentNode,
			ap = [ a ],
			bp = [ b ];

		// Parentless nodes are either documents or disconnected
		if ( !aup || !bup ) {
			return a === document ? -1 :
				b === document ? 1 :
				aup ? -1 :
				bup ? 1 :
				sortInput ?
				( indexOf( sortInput, a ) - indexOf( sortInput, b ) ) :
				0;

		// If the nodes are siblings, we can do a quick check
		} else if ( aup === bup ) {
			return siblingCheck( a, b );
		}

		// Otherwise we need full lists of their ancestors for comparison
		cur = a;
		while ( (cur = cur.parentNode) ) {
			ap.unshift( cur );
		}
		cur = b;
		while ( (cur = cur.parentNode) ) {
			bp.unshift( cur );
		}

		// Walk down the tree looking for a discrepancy
		while ( ap[i] === bp[i] ) {
			i++;
		}

		return i ?
			// Do a sibling check if the nodes have a common ancestor
			siblingCheck( ap[i], bp[i] ) :

			// Otherwise nodes in our document sort first
			ap[i] === preferredDoc ? -1 :
			bp[i] === preferredDoc ? 1 :
			0;
	};

	return document;
};

Sizzle.matches = function( expr, elements ) {
	return Sizzle( expr, null, null, elements );
};

Sizzle.matchesSelector = function( elem, expr ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	// Make sure that attribute selectors are quoted
	expr = expr.replace( rattributeQuotes, "='$1']" );

	if ( support.matchesSelector && documentIsHTML &&
		!compilerCache[ expr + " " ] &&
		( !rbuggyMatches || !rbuggyMatches.test( expr ) ) &&
		( !rbuggyQSA     || !rbuggyQSA.test( expr ) ) ) {

		try {
			var ret = matches.call( elem, expr );

			// IE 9's matchesSelector returns false on disconnected nodes
			if ( ret || support.disconnectedMatch ||
					// As well, disconnected nodes are said to be in a document
					// fragment in IE 9
					elem.document && elem.document.nodeType !== 11 ) {
				return ret;
			}
		} catch (e) {}
	}

	return Sizzle( expr, document, null, [ elem ] ).length > 0;
};

Sizzle.contains = function( context, elem ) {
	// Set document vars if needed
	if ( ( context.ownerDocument || context ) !== document ) {
		setDocument( context );
	}
	return contains( context, elem );
};

Sizzle.attr = function( elem, name ) {
	// Set document vars if needed
	if ( ( elem.ownerDocument || elem ) !== document ) {
		setDocument( elem );
	}

	var fn = Expr.attrHandle[ name.toLowerCase() ],
		// Don't get fooled by Object.prototype properties (jQuery #13807)
		val = fn && hasOwn.call( Expr.attrHandle, name.toLowerCase() ) ?
			fn( elem, name, !documentIsHTML ) :
			undefined;

	return val !== undefined ?
		val :
		support.attributes || !documentIsHTML ?
			elem.getAttribute( name ) :
			(val = elem.getAttributeNode(name)) && val.specified ?
				val.value :
				null;
};

Sizzle.escape = function( sel ) {
	return (sel + "").replace( rcssescape, fcssescape );
};

Sizzle.error = function( msg ) {
	throw new Error( "Syntax error, unrecognized expression: " + msg );
};

/**
 * Document sorting and removing duplicates
 * @param {ArrayLike} results
 */
Sizzle.uniqueSort = function( results ) {
	var elem,
		duplicates = [],
		j = 0,
		i = 0;

	// Unless we *know* we can detect duplicates, assume their presence
	hasDuplicate = !support.detectDuplicates;
	sortInput = !support.sortStable && results.slice( 0 );
	results.sort( sortOrder );

	if ( hasDuplicate ) {
		while ( (elem = results[i++]) ) {
			if ( elem === results[ i ] ) {
				j = duplicates.push( i );
			}
		}
		while ( j-- ) {
			results.splice( duplicates[ j ], 1 );
		}
	}

	// Clear input after sorting to release objects
	// See https://github.com/jquery/sizzle/pull/225
	sortInput = null;

	return results;
};

/**
 * Utility function for retrieving the text value of an array of DOM nodes
 * @param {Array|Element} elem
 */
getText = Sizzle.getText = function( elem ) {
	var node,
		ret = "",
		i = 0,
		nodeType = elem.nodeType;

	if ( !nodeType ) {
		// If no nodeType, this is expected to be an array
		while ( (node = elem[i++]) ) {
			// Do not traverse comment nodes
			ret += getText( node );
		}
	} else if ( nodeType === 1 || nodeType === 9 || nodeType === 11 ) {
		// Use textContent for elements
		// innerText usage removed for consistency of new lines (jQuery #11153)
		if ( typeof elem.textContent === "string" ) {
			return elem.textContent;
		} else {
			// Traverse its children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				ret += getText( elem );
			}
		}
	} else if ( nodeType === 3 || nodeType === 4 ) {
		return elem.nodeValue;
	}
	// Do not include comment or processing instruction nodes

	return ret;
};

Expr = Sizzle.selectors = {

	// Can be adjusted by the user
	cacheLength: 50,

	createPseudo: markFunction,

	match: matchExpr,

	attrHandle: {},

	find: {},

	relative: {
		">": { dir: "parentNode", first: true },
		" ": { dir: "parentNode" },
		"+": { dir: "previousSibling", first: true },
		"~": { dir: "previousSibling" }
	},

	preFilter: {
		"ATTR": function( match ) {
			match[1] = match[1].replace( runescape, funescape );

			// Move the given value to match[3] whether quoted or unquoted
			match[3] = ( match[3] || match[4] || match[5] || "" ).replace( runescape, funescape );

			if ( match[2] === "~=" ) {
				match[3] = " " + match[3] + " ";
			}

			return match.slice( 0, 4 );
		},

		"CHILD": function( match ) {
			/* matches from matchExpr["CHILD"]
				1 type (only|nth|...)
				2 what (child|of-type)
				3 argument (even|odd|\d*|\d*n([+-]\d+)?|...)
				4 xn-component of xn+y argument ([+-]?\d*n|)
				5 sign of xn-component
				6 x of xn-component
				7 sign of y-component
				8 y of y-component
			*/
			match[1] = match[1].toLowerCase();

			if ( match[1].slice( 0, 3 ) === "nth" ) {
				// nth-* requires argument
				if ( !match[3] ) {
					Sizzle.error( match[0] );
				}

				// numeric x and y parameters for Expr.filter.CHILD
				// remember that false/true cast respectively to 0/1
				match[4] = +( match[4] ? match[5] + (match[6] || 1) : 2 * ( match[3] === "even" || match[3] === "odd" ) );
				match[5] = +( ( match[7] + match[8] ) || match[3] === "odd" );

			// other types prohibit arguments
			} else if ( match[3] ) {
				Sizzle.error( match[0] );
			}

			return match;
		},

		"PSEUDO": function( match ) {
			var excess,
				unquoted = !match[6] && match[2];

			if ( matchExpr["CHILD"].test( match[0] ) ) {
				return null;
			}

			// Accept quoted arguments as-is
			if ( match[3] ) {
				match[2] = match[4] || match[5] || "";

			// Strip excess characters from unquoted arguments
			} else if ( unquoted && rpseudo.test( unquoted ) &&
				// Get excess from tokenize (recursively)
				(excess = tokenize( unquoted, true )) &&
				// advance to the next closing parenthesis
				(excess = unquoted.indexOf( ")", unquoted.length - excess ) - unquoted.length) ) {

				// excess is a negative index
				match[0] = match[0].slice( 0, excess );
				match[2] = unquoted.slice( 0, excess );
			}

			// Return only captures needed by the pseudo filter method (type and argument)
			return match.slice( 0, 3 );
		}
	},

	filter: {

		"TAG": function( nodeNameSelector ) {
			var nodeName = nodeNameSelector.replace( runescape, funescape ).toLowerCase();
			return nodeNameSelector === "*" ?
				function() { return true; } :
				function( elem ) {
					return elem.nodeName && elem.nodeName.toLowerCase() === nodeName;
				};
		},

		"CLASS": function( className ) {
			var pattern = classCache[ className + " " ];

			return pattern ||
				(pattern = new RegExp( "(^|" + whitespace + ")" + className + "(" + whitespace + "|$)" )) &&
				classCache( className, function( elem ) {
					return pattern.test( typeof elem.className === "string" && elem.className || typeof elem.getAttribute !== "undefined" && elem.getAttribute("class") || "" );
				});
		},

		"ATTR": function( name, operator, check ) {
			return function( elem ) {
				var result = Sizzle.attr( elem, name );

				if ( result == null ) {
					return operator === "!=";
				}
				if ( !operator ) {
					return true;
				}

				result += "";

				return operator === "=" ? result === check :
					operator === "!=" ? result !== check :
					operator === "^=" ? check && result.indexOf( check ) === 0 :
					operator === "*=" ? check && result.indexOf( check ) > -1 :
					operator === "$=" ? check && result.slice( -check.length ) === check :
					operator === "~=" ? ( " " + result.replace( rwhitespace, " " ) + " " ).indexOf( check ) > -1 :
					operator === "|=" ? result === check || result.slice( 0, check.length + 1 ) === check + "-" :
					false;
			};
		},

		"CHILD": function( type, what, argument, first, last ) {
			var simple = type.slice( 0, 3 ) !== "nth",
				forward = type.slice( -4 ) !== "last",
				ofType = what === "of-type";

			return first === 1 && last === 0 ?

				// Shortcut for :nth-*(n)
				function( elem ) {
					return !!elem.parentNode;
				} :

				function( elem, context, xml ) {
					var cache, uniqueCache, outerCache, node, nodeIndex, start,
						dir = simple !== forward ? "nextSibling" : "previousSibling",
						parent = elem.parentNode,
						name = ofType && elem.nodeName.toLowerCase(),
						useCache = !xml && !ofType,
						diff = false;

					if ( parent ) {

						// :(first|last|only)-(child|of-type)
						if ( simple ) {
							while ( dir ) {
								node = elem;
								while ( (node = node[ dir ]) ) {
									if ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) {

										return false;
									}
								}
								// Reverse direction for :only-* (if we haven't yet done so)
								start = dir = type === "only" && !start && "nextSibling";
							}
							return true;
						}

						start = [ forward ? parent.firstChild : parent.lastChild ];

						// non-xml :nth-child(...) stores cache data on `parent`
						if ( forward && useCache ) {

							// Seek `elem` from a previously-cached index

							// ...in a gzip-friendly way
							node = parent;
							outerCache = node[ expando ] || (node[ expando ] = {});

							// Support: IE <9 only
							// Defend against cloned attroperties (jQuery gh-1709)
							uniqueCache = outerCache[ node.uniqueID ] ||
								(outerCache[ node.uniqueID ] = {});

							cache = uniqueCache[ type ] || [];
							nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
							diff = nodeIndex && cache[ 2 ];
							node = nodeIndex && parent.childNodes[ nodeIndex ];

							while ( (node = ++nodeIndex && node && node[ dir ] ||

								// Fallback to seeking `elem` from the start
								(diff = nodeIndex = 0) || start.pop()) ) {

								// When found, cache indexes on `parent` and break
								if ( node.nodeType === 1 && ++diff && node === elem ) {
									uniqueCache[ type ] = [ dirruns, nodeIndex, diff ];
									break;
								}
							}

						} else {
							// Use previously-cached element index if available
							if ( useCache ) {
								// ...in a gzip-friendly way
								node = elem;
								outerCache = node[ expando ] || (node[ expando ] = {});

								// Support: IE <9 only
								// Defend against cloned attroperties (jQuery gh-1709)
								uniqueCache = outerCache[ node.uniqueID ] ||
									(outerCache[ node.uniqueID ] = {});

								cache = uniqueCache[ type ] || [];
								nodeIndex = cache[ 0 ] === dirruns && cache[ 1 ];
								diff = nodeIndex;
							}

							// xml :nth-child(...)
							// or :nth-last-child(...) or :nth(-last)?-of-type(...)
							if ( diff === false ) {
								// Use the same loop as above to seek `elem` from the start
								while ( (node = ++nodeIndex && node && node[ dir ] ||
									(diff = nodeIndex = 0) || start.pop()) ) {

									if ( ( ofType ?
										node.nodeName.toLowerCase() === name :
										node.nodeType === 1 ) &&
										++diff ) {

										// Cache the index of each encountered element
										if ( useCache ) {
											outerCache = node[ expando ] || (node[ expando ] = {});

											// Support: IE <9 only
											// Defend against cloned attroperties (jQuery gh-1709)
											uniqueCache = outerCache[ node.uniqueID ] ||
												(outerCache[ node.uniqueID ] = {});

											uniqueCache[ type ] = [ dirruns, diff ];
										}

										if ( node === elem ) {
											break;
										}
									}
								}
							}
						}

						// Incorporate the offset, then check against cycle size
						diff -= last;
						return diff === first || ( diff % first === 0 && diff / first >= 0 );
					}
				};
		},

		"PSEUDO": function( pseudo, argument ) {
			// pseudo-class names are case-insensitive
			// http://www.w3.org/TR/selectors/#pseudo-classes
			// Prioritize by case sensitivity in case custom pseudos are added with uppercase letters
			// Remember that setFilters inherits from pseudos
			var args,
				fn = Expr.pseudos[ pseudo ] || Expr.setFilters[ pseudo.toLowerCase() ] ||
					Sizzle.error( "unsupported pseudo: " + pseudo );

			// The user may use createPseudo to indicate that
			// arguments are needed to create the filter function
			// just as Sizzle does
			if ( fn[ expando ] ) {
				return fn( argument );
			}

			// But maintain support for old signatures
			if ( fn.length > 1 ) {
				args = [ pseudo, pseudo, "", argument ];
				return Expr.setFilters.hasOwnProperty( pseudo.toLowerCase() ) ?
					markFunction(function( seed, matches ) {
						var idx,
							matched = fn( seed, argument ),
							i = matched.length;
						while ( i-- ) {
							idx = indexOf( seed, matched[i] );
							seed[ idx ] = !( matches[ idx ] = matched[i] );
						}
					}) :
					function( elem ) {
						return fn( elem, 0, args );
					};
			}

			return fn;
		}
	},

	pseudos: {
		// Potentially complex pseudos
		"not": markFunction(function( selector ) {
			// Trim the selector passed to compile
			// to avoid treating leading and trailing
			// spaces as combinators
			var input = [],
				results = [],
				matcher = compile( selector.replace( rtrim, "$1" ) );

			return matcher[ expando ] ?
				markFunction(function( seed, matches, context, xml ) {
					var elem,
						unmatched = matcher( seed, null, xml, [] ),
						i = seed.length;

					// Match elements unmatched by `matcher`
					while ( i-- ) {
						if ( (elem = unmatched[i]) ) {
							seed[i] = !(matches[i] = elem);
						}
					}
				}) :
				function( elem, context, xml ) {
					input[0] = elem;
					matcher( input, null, xml, results );
					// Don't keep the element (issue #299)
					input[0] = null;
					return !results.pop();
				};
		}),

		"has": markFunction(function( selector ) {
			return function( elem ) {
				return Sizzle( selector, elem ).length > 0;
			};
		}),

		"contains": markFunction(function( text ) {
			text = text.replace( runescape, funescape );
			return function( elem ) {
				return ( elem.textContent || elem.innerText || getText( elem ) ).indexOf( text ) > -1;
			};
		}),

		// "Whether an element is represented by a :lang() selector
		// is based solely on the element's language value
		// being equal to the identifier C,
		// or beginning with the identifier C immediately followed by "-".
		// The matching of C against the element's language value is performed case-insensitively.
		// The identifier C does not have to be a valid language name."
		// http://www.w3.org/TR/selectors/#lang-pseudo
		"lang": markFunction( function( lang ) {
			// lang value must be a valid identifier
			if ( !ridentifier.test(lang || "") ) {
				Sizzle.error( "unsupported lang: " + lang );
			}
			lang = lang.replace( runescape, funescape ).toLowerCase();
			return function( elem ) {
				var elemLang;
				do {
					if ( (elemLang = documentIsHTML ?
						elem.lang :
						elem.getAttribute("xml:lang") || elem.getAttribute("lang")) ) {

						elemLang = elemLang.toLowerCase();
						return elemLang === lang || elemLang.indexOf( lang + "-" ) === 0;
					}
				} while ( (elem = elem.parentNode) && elem.nodeType === 1 );
				return false;
			};
		}),

		// Miscellaneous
		"target": function( elem ) {
			var hash = window.location && window.location.hash;
			return hash && hash.slice( 1 ) === elem.id;
		},

		"root": function( elem ) {
			return elem === docElem;
		},

		"focus": function( elem ) {
			return elem === document.activeElement && (!document.hasFocus || document.hasFocus()) && !!(elem.type || elem.href || ~elem.tabIndex);
		},

		// Boolean properties
		"enabled": createDisabledPseudo( false ),
		"disabled": createDisabledPseudo( true ),

		"checked": function( elem ) {
			// In CSS3, :checked should return both checked and selected elements
			// http://www.w3.org/TR/2011/REC-css3-selectors-20110929/#checked
			var nodeName = elem.nodeName.toLowerCase();
			return (nodeName === "input" && !!elem.checked) || (nodeName === "option" && !!elem.selected);
		},

		"selected": function( elem ) {
			// Accessing this property makes selected-by-default
			// options in Safari work properly
			if ( elem.parentNode ) {
				elem.parentNode.selectedIndex;
			}

			return elem.selected === true;
		},

		// Contents
		"empty": function( elem ) {
			// http://www.w3.org/TR/selectors/#empty-pseudo
			// :empty is negated by element (1) or content nodes (text: 3; cdata: 4; entity ref: 5),
			//   but not by others (comment: 8; processing instruction: 7; etc.)
			// nodeType < 6 works because attributes (2) do not appear as children
			for ( elem = elem.firstChild; elem; elem = elem.nextSibling ) {
				if ( elem.nodeType < 6 ) {
					return false;
				}
			}
			return true;
		},

		"parent": function( elem ) {
			return !Expr.pseudos["empty"]( elem );
		},

		// Element/input types
		"header": function( elem ) {
			return rheader.test( elem.nodeName );
		},

		"input": function( elem ) {
			return rinputs.test( elem.nodeName );
		},

		"button": function( elem ) {
			var name = elem.nodeName.toLowerCase();
			return name === "input" && elem.type === "button" || name === "button";
		},

		"text": function( elem ) {
			var attr;
			return elem.nodeName.toLowerCase() === "input" &&
				elem.type === "text" &&

				// Support: IE<8
				// New HTML5 attribute values (e.g., "search") appear with elem.type === "text"
				( (attr = elem.getAttribute("type")) == null || attr.toLowerCase() === "text" );
		},

		// Position-in-collection
		"first": createPositionalPseudo(function() {
			return [ 0 ];
		}),

		"last": createPositionalPseudo(function( matchIndexes, length ) {
			return [ length - 1 ];
		}),

		"eq": createPositionalPseudo(function( matchIndexes, length, argument ) {
			return [ argument < 0 ? argument + length : argument ];
		}),

		"even": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 0;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"odd": createPositionalPseudo(function( matchIndexes, length ) {
			var i = 1;
			for ( ; i < length; i += 2 ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"lt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; --i >= 0; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		}),

		"gt": createPositionalPseudo(function( matchIndexes, length, argument ) {
			var i = argument < 0 ? argument + length : argument;
			for ( ; ++i < length; ) {
				matchIndexes.push( i );
			}
			return matchIndexes;
		})
	}
};

Expr.pseudos["nth"] = Expr.pseudos["eq"];

// Add button/input type pseudos
for ( i in { radio: true, checkbox: true, file: true, password: true, image: true } ) {
	Expr.pseudos[ i ] = createInputPseudo( i );
}
for ( i in { submit: true, reset: true } ) {
	Expr.pseudos[ i ] = createButtonPseudo( i );
}

// Easy API for creating new setFilters
function setFilters() {}
setFilters.prototype = Expr.filters = Expr.pseudos;
Expr.setFilters = new setFilters();

tokenize = Sizzle.tokenize = function( selector, parseOnly ) {
	var matched, match, tokens, type,
		soFar, groups, preFilters,
		cached = tokenCache[ selector + " " ];

	if ( cached ) {
		return parseOnly ? 0 : cached.slice( 0 );
	}

	soFar = selector;
	groups = [];
	preFilters = Expr.preFilter;

	while ( soFar ) {

		// Comma and first run
		if ( !matched || (match = rcomma.exec( soFar )) ) {
			if ( match ) {
				// Don't consume trailing commas as valid
				soFar = soFar.slice( match[0].length ) || soFar;
			}
			groups.push( (tokens = []) );
		}

		matched = false;

		// Combinators
		if ( (match = rcombinators.exec( soFar )) ) {
			matched = match.shift();
			tokens.push({
				value: matched,
				// Cast descendant combinators to space
				type: match[0].replace( rtrim, " " )
			});
			soFar = soFar.slice( matched.length );
		}

		// Filters
		for ( type in Expr.filter ) {
			if ( (match = matchExpr[ type ].exec( soFar )) && (!preFilters[ type ] ||
				(match = preFilters[ type ]( match ))) ) {
				matched = match.shift();
				tokens.push({
					value: matched,
					type: type,
					matches: match
				});
				soFar = soFar.slice( matched.length );
			}
		}

		if ( !matched ) {
			break;
		}
	}

	// Return the length of the invalid excess
	// if we're just parsing
	// Otherwise, throw an error or return tokens
	return parseOnly ?
		soFar.length :
		soFar ?
			Sizzle.error( selector ) :
			// Cache the tokens
			tokenCache( selector, groups ).slice( 0 );
};

function toSelector( tokens ) {
	var i = 0,
		len = tokens.length,
		selector = "";
	for ( ; i < len; i++ ) {
		selector += tokens[i].value;
	}
	return selector;
}

function addCombinator( matcher, combinator, base ) {
	var dir = combinator.dir,
		skip = combinator.next,
		key = skip || dir,
		checkNonElements = base && key === "parentNode",
		doneName = done++;

	return combinator.first ?
		// Check against closest ancestor/preceding element
		function( elem, context, xml ) {
			while ( (elem = elem[ dir ]) ) {
				if ( elem.nodeType === 1 || checkNonElements ) {
					return matcher( elem, context, xml );
				}
			}
			return false;
		} :

		// Check against all ancestor/preceding elements
		function( elem, context, xml ) {
			var oldCache, uniqueCache, outerCache,
				newCache = [ dirruns, doneName ];

			// We can't set arbitrary data on XML nodes, so they don't benefit from combinator caching
			if ( xml ) {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						if ( matcher( elem, context, xml ) ) {
							return true;
						}
					}
				}
			} else {
				while ( (elem = elem[ dir ]) ) {
					if ( elem.nodeType === 1 || checkNonElements ) {
						outerCache = elem[ expando ] || (elem[ expando ] = {});

						// Support: IE <9 only
						// Defend against cloned attroperties (jQuery gh-1709)
						uniqueCache = outerCache[ elem.uniqueID ] || (outerCache[ elem.uniqueID ] = {});

						if ( skip && skip === elem.nodeName.toLowerCase() ) {
							elem = elem[ dir ] || elem;
						} else if ( (oldCache = uniqueCache[ key ]) &&
							oldCache[ 0 ] === dirruns && oldCache[ 1 ] === doneName ) {

							// Assign to newCache so results back-propagate to previous elements
							return (newCache[ 2 ] = oldCache[ 2 ]);
						} else {
							// Reuse newcache so results back-propagate to previous elements
							uniqueCache[ key ] = newCache;

							// A match means we're done; a fail means we have to keep checking
							if ( (newCache[ 2 ] = matcher( elem, context, xml )) ) {
								return true;
							}
						}
					}
				}
			}
			return false;
		};
}

function elementMatcher( matchers ) {
	return matchers.length > 1 ?
		function( elem, context, xml ) {
			var i = matchers.length;
			while ( i-- ) {
				if ( !matchers[i]( elem, context, xml ) ) {
					return false;
				}
			}
			return true;
		} :
		matchers[0];
}

function multipleContexts( selector, contexts, results ) {
	var i = 0,
		len = contexts.length;
	for ( ; i < len; i++ ) {
		Sizzle( selector, contexts[i], results );
	}
	return results;
}

function condense( unmatched, map, filter, context, xml ) {
	var elem,
		newUnmatched = [],
		i = 0,
		len = unmatched.length,
		mapped = map != null;

	for ( ; i < len; i++ ) {
		if ( (elem = unmatched[i]) ) {
			if ( !filter || filter( elem, context, xml ) ) {
				newUnmatched.push( elem );
				if ( mapped ) {
					map.push( i );
				}
			}
		}
	}

	return newUnmatched;
}

function setMatcher( preFilter, selector, matcher, postFilter, postFinder, postSelector ) {
	if ( postFilter && !postFilter[ expando ] ) {
		postFilter = setMatcher( postFilter );
	}
	if ( postFinder && !postFinder[ expando ] ) {
		postFinder = setMatcher( postFinder, postSelector );
	}
	return markFunction(function( seed, results, context, xml ) {
		var temp, i, elem,
			preMap = [],
			postMap = [],
			preexisting = results.length,

			// Get initial elements from seed or context
			elems = seed || multipleContexts( selector || "*", context.nodeType ? [ context ] : context, [] ),

			// Prefilter to get matcher input, preserving a map for seed-results synchronization
			matcherIn = preFilter && ( seed || !selector ) ?
				condense( elems, preMap, preFilter, context, xml ) :
				elems,

			matcherOut = matcher ?
				// If we have a postFinder, or filtered seed, or non-seed postFilter or preexisting results,
				postFinder || ( seed ? preFilter : preexisting || postFilter ) ?

					// ...intermediate processing is necessary
					[] :

					// ...otherwise use results directly
					results :
				matcherIn;

		// Find primary matches
		if ( matcher ) {
			matcher( matcherIn, matcherOut, context, xml );
		}

		// Apply postFilter
		if ( postFilter ) {
			temp = condense( matcherOut, postMap );
			postFilter( temp, [], context, xml );

			// Un-match failing elements by moving them back to matcherIn
			i = temp.length;
			while ( i-- ) {
				if ( (elem = temp[i]) ) {
					matcherOut[ postMap[i] ] = !(matcherIn[ postMap[i] ] = elem);
				}
			}
		}

		if ( seed ) {
			if ( postFinder || preFilter ) {
				if ( postFinder ) {
					// Get the final matcherOut by condensing this intermediate into postFinder contexts
					temp = [];
					i = matcherOut.length;
					while ( i-- ) {
						if ( (elem = matcherOut[i]) ) {
							// Restore matcherIn since elem is not yet a final match
							temp.push( (matcherIn[i] = elem) );
						}
					}
					postFinder( null, (matcherOut = []), temp, xml );
				}

				// Move matched elements from seed to results to keep them synchronized
				i = matcherOut.length;
				while ( i-- ) {
					if ( (elem = matcherOut[i]) &&
						(temp = postFinder ? indexOf( seed, elem ) : preMap[i]) > -1 ) {

						seed[temp] = !(results[temp] = elem);
					}
				}
			}

		// Add elements to results, through postFinder if defined
		} else {
			matcherOut = condense(
				matcherOut === results ?
					matcherOut.splice( preexisting, matcherOut.length ) :
					matcherOut
			);
			if ( postFinder ) {
				postFinder( null, results, matcherOut, xml );
			} else {
				push.apply( results, matcherOut );
			}
		}
	});
}

function matcherFromTokens( tokens ) {
	var checkContext, matcher, j,
		len = tokens.length,
		leadingRelative = Expr.relative[ tokens[0].type ],
		implicitRelative = leadingRelative || Expr.relative[" "],
		i = leadingRelative ? 1 : 0,

		// The foundational matcher ensures that elements are reachable from top-level context(s)
		matchContext = addCombinator( function( elem ) {
			return elem === checkContext;
		}, implicitRelative, true ),
		matchAnyContext = addCombinator( function( elem ) {
			return indexOf( checkContext, elem ) > -1;
		}, implicitRelative, true ),
		matchers = [ function( elem, context, xml ) {
			var ret = ( !leadingRelative && ( xml || context !== outermostContext ) ) || (
				(checkContext = context).nodeType ?
					matchContext( elem, context, xml ) :
					matchAnyContext( elem, context, xml ) );
			// Avoid hanging onto element (issue #299)
			checkContext = null;
			return ret;
		} ];

	for ( ; i < len; i++ ) {
		if ( (matcher = Expr.relative[ tokens[i].type ]) ) {
			matchers = [ addCombinator(elementMatcher( matchers ), matcher) ];
		} else {
			matcher = Expr.filter[ tokens[i].type ].apply( null, tokens[i].matches );

			// Return special upon seeing a positional matcher
			if ( matcher[ expando ] ) {
				// Find the next relative operator (if any) for proper handling
				j = ++i;
				for ( ; j < len; j++ ) {
					if ( Expr.relative[ tokens[j].type ] ) {
						break;
					}
				}
				return setMatcher(
					i > 1 && elementMatcher( matchers ),
					i > 1 && toSelector(
						// If the preceding token was a descendant combinator, insert an implicit any-element `*`
						tokens.slice( 0, i - 1 ).concat({ value: tokens[ i - 2 ].type === " " ? "*" : "" })
					).replace( rtrim, "$1" ),
					matcher,
					i < j && matcherFromTokens( tokens.slice( i, j ) ),
					j < len && matcherFromTokens( (tokens = tokens.slice( j )) ),
					j < len && toSelector( tokens )
				);
			}
			matchers.push( matcher );
		}
	}

	return elementMatcher( matchers );
}

function matcherFromGroupMatchers( elementMatchers, setMatchers ) {
	var bySet = setMatchers.length > 0,
		byElement = elementMatchers.length > 0,
		superMatcher = function( seed, context, xml, results, outermost ) {
			var elem, j, matcher,
				matchedCount = 0,
				i = "0",
				unmatched = seed && [],
				setMatched = [],
				contextBackup = outermostContext,
				// We must always have either seed elements or outermost context
				elems = seed || byElement && Expr.find["TAG"]( "*", outermost ),
				// Use integer dirruns iff this is the outermost matcher
				dirrunsUnique = (dirruns += contextBackup == null ? 1 : Math.random() || 0.1),
				len = elems.length;

			if ( outermost ) {
				outermostContext = context === document || context || outermost;
			}

			// Add elements passing elementMatchers directly to results
			// Support: IE<9, Safari
			// Tolerate NodeList properties (IE: "length"; Safari: <number>) matching elements by id
			for ( ; i !== len && (elem = elems[i]) != null; i++ ) {
				if ( byElement && elem ) {
					j = 0;
					if ( !context && elem.ownerDocument !== document ) {
						setDocument( elem );
						xml = !documentIsHTML;
					}
					while ( (matcher = elementMatchers[j++]) ) {
						if ( matcher( elem, context || document, xml) ) {
							results.push( elem );
							break;
						}
					}
					if ( outermost ) {
						dirruns = dirrunsUnique;
					}
				}

				// Track unmatched elements for set filters
				if ( bySet ) {
					// They will have gone through all possible matchers
					if ( (elem = !matcher && elem) ) {
						matchedCount--;
					}

					// Lengthen the array for every element, matched or not
					if ( seed ) {
						unmatched.push( elem );
					}
				}
			}

			// `i` is now the count of elements visited above, and adding it to `matchedCount`
			// makes the latter nonnegative.
			matchedCount += i;

			// Apply set filters to unmatched elements
			// NOTE: This can be skipped if there are no unmatched elements (i.e., `matchedCount`
			// equals `i`), unless we didn't visit _any_ elements in the above loop because we have
			// no element matchers and no seed.
			// Incrementing an initially-string "0" `i` allows `i` to remain a string only in that
			// case, which will result in a "00" `matchedCount` that differs from `i` but is also
			// numerically zero.
			if ( bySet && i !== matchedCount ) {
				j = 0;
				while ( (matcher = setMatchers[j++]) ) {
					matcher( unmatched, setMatched, context, xml );
				}

				if ( seed ) {
					// Reintegrate element matches to eliminate the need for sorting
					if ( matchedCount > 0 ) {
						while ( i-- ) {
							if ( !(unmatched[i] || setMatched[i]) ) {
								setMatched[i] = pop.call( results );
							}
						}
					}

					// Discard index placeholder values to get only actual matches
					setMatched = condense( setMatched );
				}

				// Add matches to results
				push.apply( results, setMatched );

				// Seedless set matches succeeding multiple successful matchers stipulate sorting
				if ( outermost && !seed && setMatched.length > 0 &&
					( matchedCount + setMatchers.length ) > 1 ) {

					Sizzle.uniqueSort( results );
				}
			}

			// Override manipulation of globals by nested matchers
			if ( outermost ) {
				dirruns = dirrunsUnique;
				outermostContext = contextBackup;
			}

			return unmatched;
		};

	return bySet ?
		markFunction( superMatcher ) :
		superMatcher;
}

compile = Sizzle.compile = function( selector, match /* Internal Use Only */ ) {
	var i,
		setMatchers = [],
		elementMatchers = [],
		cached = compilerCache[ selector + " " ];

	if ( !cached ) {
		// Generate a function of recursive functions that can be used to check each element
		if ( !match ) {
			match = tokenize( selector );
		}
		i = match.length;
		while ( i-- ) {
			cached = matcherFromTokens( match[i] );
			if ( cached[ expando ] ) {
				setMatchers.push( cached );
			} else {
				elementMatchers.push( cached );
			}
		}

		// Cache the compiled function
		cached = compilerCache( selector, matcherFromGroupMatchers( elementMatchers, setMatchers ) );

		// Save selector and tokenization
		cached.selector = selector;
	}
	return cached;
};

/**
 * A low-level selection function that works with Sizzle's compiled
 *  selector functions
 * @param {String|Function} selector A selector or a pre-compiled
 *  selector function built with Sizzle.compile
 * @param {Element} context
 * @param {Array} [results]
 * @param {Array} [seed] A set of elements to match against
 */
select = Sizzle.select = function( selector, context, results, seed ) {
	var i, tokens, token, type, find,
		compiled = typeof selector === "function" && selector,
		match = !seed && tokenize( (selector = compiled.selector || selector) );

	results = results || [];

	// Try to minimize operations if there is only one selector in the list and no seed
	// (the latter of which guarantees us context)
	if ( match.length === 1 ) {

		// Reduce context if the leading compound selector is an ID
		tokens = match[0] = match[0].slice( 0 );
		if ( tokens.length > 2 && (token = tokens[0]).type === "ID" &&
				context.nodeType === 9 && documentIsHTML && Expr.relative[ tokens[1].type ] ) {

			context = ( Expr.find["ID"]( token.matches[0].replace(runescape, funescape), context ) || [] )[0];
			if ( !context ) {
				return results;

			// Precompiled matchers will still verify ancestry, so step up a level
			} else if ( compiled ) {
				context = context.parentNode;
			}

			selector = selector.slice( tokens.shift().value.length );
		}

		// Fetch a seed set for right-to-left matching
		i = matchExpr["needsContext"].test( selector ) ? 0 : tokens.length;
		while ( i-- ) {
			token = tokens[i];

			// Abort if we hit a combinator
			if ( Expr.relative[ (type = token.type) ] ) {
				break;
			}
			if ( (find = Expr.find[ type ]) ) {
				// Search, expanding context for leading sibling combinators
				if ( (seed = find(
					token.matches[0].replace( runescape, funescape ),
					rsibling.test( tokens[0].type ) && testContext( context.parentNode ) || context
				)) ) {

					// If seed is empty or no tokens remain, we can return early
					tokens.splice( i, 1 );
					selector = seed.length && toSelector( tokens );
					if ( !selector ) {
						push.apply( results, seed );
						return results;
					}

					break;
				}
			}
		}
	}

	// Compile and execute a filtering function if one is not provided
	// Provide `match` to avoid retokenization if we modified the selector above
	( compiled || compile( selector, match ) )(
		seed,
		context,
		!documentIsHTML,
		results,
		!context || rsibling.test( selector ) && testContext( context.parentNode ) || context
	);
	return results;
};

// One-time assignments

// Sort stability
support.sortStable = expando.split("").sort( sortOrder ).join("") === expando;

// Support: Chrome 14-35+
// Always assume duplicates if they aren't passed to the comparison function
support.detectDuplicates = !!hasDuplicate;

// Initialize against the default document
setDocument();

// Support: Webkit<537.32 - Safari 6.0.3/Chrome 25 (fixed in Chrome 27)
// Detached nodes confoundingly follow *each other*
support.sortDetached = assert(function( el ) {
	// Should return 1, but returns 4 (following)
	return el.compareDocumentPosition( document.createElement("fieldset") ) & 1;
});

// Support: IE<8
// Prevent attribute/property "interpolation"
// https://msdn.microsoft.com/en-us/library/ms536429%28VS.85%29.aspx
if ( !assert(function( el ) {
	el.innerHTML = "<a href='#'></a>";
	return el.firstChild.getAttribute("href") === "#" ;
}) ) {
	addHandle( "type|href|height|width", function( elem, name, isXML ) {
		if ( !isXML ) {
			return elem.getAttribute( name, name.toLowerCase() === "type" ? 1 : 2 );
		}
	});
}

// Support: IE<9
// Use defaultValue in place of getAttribute("value")
if ( !support.attributes || !assert(function( el ) {
	el.innerHTML = "<input/>";
	el.firstChild.setAttribute( "value", "" );
	return el.firstChild.getAttribute( "value" ) === "";
}) ) {
	addHandle( "value", function( elem, name, isXML ) {
		if ( !isXML && elem.nodeName.toLowerCase() === "input" ) {
			return elem.defaultValue;
		}
	});
}

// Support: IE<9
// Use getAttributeNode to fetch booleans when getAttribute lies
if ( !assert(function( el ) {
	return el.getAttribute("disabled") == null;
}) ) {
	addHandle( booleans, function( elem, name, isXML ) {
		var val;
		if ( !isXML ) {
			return elem[ name ] === true ? name.toLowerCase() :
					(val = elem.getAttributeNode( name )) && val.specified ?
					val.value :
				null;
		}
	});
}

// EXPOSE
var _sizzle = window.Sizzle;

Sizzle.noConflict = function() {
	if ( window.Sizzle === Sizzle ) {
		window.Sizzle = _sizzle;
	}

	return Sizzle;
};

if ( typeof define === "function" && define.amd ) {
	define(function() { return Sizzle; });
// Sizzle requires that there be a global window in Common-JS like environments
} else if ( typeof module !== "undefined" && module.exports ) {
	module.exports = Sizzle;
} else {
	window.Sizzle = Sizzle;
}
// EXPOSE
return Sizzle;
})( window );

/**
 * swg框架
 * swg框架包含：CSS选择器、DOM操作、常用工具方法 三部分。
 * 调用方法为：swg("")、swg("").children()、swg.getParam()
 * */
(function(){
	/**
	 * 选择器适配器，适配器模式
	 * @type {{select: Function}}
	 */
	var selectorAdapter = {
		select: function(selector, context, results, seed){
			return new Sizzle(selector, context, results, seed);
		}
	};
	var select = selectorAdapter.select;

	/**
	 * 构造函数新增方法
	 * @param constructor
	 * @param methodName
	 * @param handler
	 */
	function addMethod(constructor, methodName, handler){
		constructor.prototype[methodName] = handler;
	}

	/**
	 * 框架核心类，包含 HTMLElement数组 和 DOM操作方法
	 * @param nodes HTMLElement数组
	 * @constructor
	 */
	function Node(nodes) {
		if(!nodes instanceof Array) throw new Error("必须传入HTMLElement数组");
		this.nodes = nodes;
		this.length = this.nodes.length;
		for(var i in nodes){
			this[i] = nodes[i];
		}
	}
	/**
	 * Node工厂
	 * @type {{create: Function}}
	 */
	var NodeFactory = {
		create: function(nodes){
			return new Node(nodes);
		}
	}
	Node.prototype = {
		//Node实例的constructor属性并不一定指向构造函数，而是与Node.prototype.constructor指向相同
		constructor: Node,

		//*****************事件*****************
		/**
		 * 绑定事件和处理方法
		 * @param eventType 事件类型
		 * @param handler 处理方法
		 */
		bind: (function() {
			//addEventListener 添加事件方法
			var addEventListener = (function() {
				if(window.addEventListener){
					return function(domNode, eventType, handler){
						//W3C，当为同一元素的同一事件添加处理方法时，会根据添加顺序依次执行
						domNode.addEventListener(eventType, handler, false);
					}
				} else if (window.attachEvent) {
					return function(domNode, eventType, handler){
						var dom0EventType = "on" + eventType;
						//IE 5 6 7 8，但执行顺序与添加顺序相反
						domNode.attachEvent(dom0EventType, function (event) {
							//提供自定义event.preventDefault()
							event.preventDefault = event.preventDefault instanceof Function ? event.preventDefault : function () {
								event.returnValue = false;//IE 5 6 7 8 9 10
							}
							//提供自定义event.stopPropagation()
							event.stopPropagation = event.stopPropagation instanceof Function ? event.preventDefault : function () {
								event.cancelBubble = true;//IE 6 7 8 9 10
							};
							//执行回调函数
							handler.call(domNode, event);
						});
					}
				}else{
					return function(domNode, eventType, handler){
						var dom0EventType = "on" + eventType;
						//一般不会执行，上面两种方法基本已经适用各种浏览器
						var oldHandler = domNode[dom0EventType];
						domNode[dom0EventType] = function (event) {
							//dom0级别事件event对象在window中获取
							event = event ? event : window.event;
							if (oldHandler instanceof Function) {
								oldHandler.call(domNode, event)
							}
							handler.call(domNode, event);
						}
					}
				}
			})();
			return function(eventType, handler) {
				this.each(function () {
					addEventListener(this, eventType, handler);
				});
				return this;
			}
		}()),
		/**
		 * 解除绑定事件
		 * @param eventType 事件类型
		 * @param handler 处理方法
		 */
		unbind: function(eventType, handler){
			this.each(function(){
				if(handler) {
					if (this.removeEventListener) {
						this.removeEventListener(eventType, handler, false);
					} else if (this.detachEvent) {
						this.detachEvent("on" + eventType, function () {
							handler.call(this);
						});
					} else {
						this["on"+eventType] = null;
					}
				}else{
					this["on"+eventType] = null;
				}
			});
		},
		/**
		 * 手动触发事件
		 * @param eventType 事件类型
		 */
		trigger: function(eventType){
			this.each(function(){
				try{
					//DOM
					var event = document.createEvent('Events');
					event.initEvent(eventType, true, false);
					this.dispatchEvent(event);
				}catch(e){
					//IE
					this.fireEvent('on'+eventType);
				}
			});
			return this;
		},
		/**
		 * 绑定或触发事件
		 * @param eventType 事件类型
		 */
		bindOrTrigger: function(eventType, handler){
			if(handler){
				this.bind(eventType, handler);
			}else{
				this.trigger(eventType);
			}
			return this;
		},

		//*****************元素筛选*****************
		/**
		 * 过滤方法，对Node进行过滤
		 * @param selector
		 * @returns {nodeArray}
		 */
		filter: function(selector){
			selector = selector ? selector : "*";
			var nodeArray = selectorAdapter.select(selector, null, null, this.nodes);
			return NodeFactory.create(nodeArray);
		},
		/**
		 * 查找兄弟节点
		 * @param selector
		 * @returns {*}
		 */
		siblings: function(selector){
			var array = [];
			this.each(function(){
				var childNodes = (this.parentNode || this.parent).childNodes;
				childNodes = swg.nodeListToNodeArray(childNodes);
				for (var j=0;j<childNodes.length;j++) {//去掉不是Element类型的节点和node自己
					if (childNodes[j].nodeType === 1 && childNodes[j] !== this) {
						array.push(childNodes[j]);
					}
				}
			});
			return NodeFactory.create(array).filter(selector);
		},
		/**
		 * 查找后面的兄弟节点
		 * @param selector
		 * @returns {*}
		 */
		afterSiblings: function(selector){
			var array = [];
			for(var i in this.nodes) {
				var node = this.nodes[i];
				var lastChild = node.parentNode.lastChild;
				while(node !== lastChild){
					node = node.nextSibling;
					if(node.nodeType === 1){
						array.push(node);
					}
				}
			}
			return NodeFactory.create(array).filter(selector);
		},
		/**
		 * 查找前面的兄弟节点
		 * @param selector
		 * @returns {*}
		 */
		beforeSiblings: function(selector){
			var array = [];
			for(var i in this.nodes) {
				var node = this.nodes[i];
				var firstChild = node.parentNode.firstChild;
				while(firstChild != node){
					firstChild = firstChild.nextSibling;
					if(node.nodeType === 1){
						array.push(node);
					}
				}
			}
			return NodeFactory.create(array).filter(selector);
		},
		/**
		 * 查找子元素
		 * @param selector
		 */
		children: function(selector){
			var array = [];
			this.each(function(){
				swg.each(this.childNodes, function(){
					if(this.nodeType === 1){
						array.push(this);
					}
				});
			});
			return NodeFactory.create(array).filter(selector);
		},
		/**
		 * 查找后代元素
		 * @param selector
		 */
		find: function(selector){
			var array = [];
			this.each(function(){
				array = array.concat(swg.getDescendantNodes(this));
			});
			return NodeFactory.create(array).filter(selector);
		},
		/**
		 * 获取第index个dom元素
		 * @param index
		 * @returns {*}
		 */
		get: function(index){
			return this.nodes[index];
		},
		/**
		 * 获取第index个元素
		 * @param index
		 * @returns {*}
		 */
		eq: function(index){
			return NodeFactory.create(this.nodes[index] ? [this.nodes[index]] : []);
		},
		/**
		 * 获取第一个元素
		 * @returns {*}
		 */
		first: function(){
			return this.eq(0);
		},
		/**
		 * 获取最后一个元素
		 * @returns {*}
		 */
		last: function(){
			return this.eq(this.length - 1)
		},
		/**
		 * 获取父节点
		 * @param selector
		 */
		parent: function(){
			var array = [];
			this.each(function(){
				array.push(this.parentNode);
			});
			return NodeFactory.create(array);
		},

		//*****************元素属性*****************
		/**
		 * 判断当前节点含有class
		 * @param index {number} 序号
		 */
		hasClass: function(className){
			var hasClass = false;
			this.each(function(){
				if(swg.hasClass(this, className)){
					hasClass = true;
				}
			});
			return hasClass;
		},
		/**
		 * 添加class
		 * @param className
		 */
		addClass: function(className){
			this.each(function(){
				if(!swg.hasClass(this, className)){
					this.className += (this.className ? " " : "") + className;
				}
			});
		},
		/**
		 * 设置行内style样式
		 * @param sName
		 * @param sValue
		 */
		css: function(sName, sValue){

			if(sName && swg.isString(sName)){
				sName = swg.cssToCamel(sName);
				if(sValue !== undefined){
					this.each(function(){
						this.style[sName] = sValue;
					})
					return this;
				}else{
					return this[0] ? this[0].style[sName] : "";
				}
			}else{
				return;
			}
		},
		/**
		 * 获取外部CSS样式，如css文件或style标签内应用到当前元素的样式
		 * @param sName
		 * @param sValue
		 */
		getLinkCss: function(sName){
			var firstNode = this[0];
			if(!firstNode) return;
			if(document.defaultView && document.defaultView.getComputedStyle){ // W3C
				return document.defaultView.getComputedStyle(firstNode, null).getPropertyValue(sName);
			}else if(firstNode.currentStyle){
				return firstNode.currentStyle[swg.cssToCamel(sName)];
			}else{
				return null;
			}
		},
		/**
		 * 删除class
		 * @param className
		 */
		removeClass: function(className){
			this.each(function(){
				var classNameArray = this.className.split(" ");
				for(var i=0;i<classNameArray.length;i++){
					if(classNameArray[i] == className){
						classNameArray.splice(i--, 1);
					}
				}
				this.className = classNameArray.join(" ");
			});
		},
		show: function(){
			this.each(function(){
				this.style.display = null;
			})
		},
		hide: function(){
			this.each(function(){
				this.style.display = "none";
			})
		},
		/**
		 * 获取||设置文本（获取第一个节点的文本||设置所有节点的文本）
		 */
		text: function(text){
			if(text === undefined || text === null){
				if(this.nodes.length > 0){
					if (typeof this.nodes[0].textContent == "string") {
						return this.nodes[0].textContent;//DOM3，IE9+
					} else if (this.nodes[0].innerText == "string") {
						return this.nodes[0].innerText;//DOM0
					} else {
						//老版本火狐不支持textContent
						function getText(node) {
							var text = "";
							for (var i in node.childNodes) {
								var cNode = node.childNodes[i];
								text += cNode.nodeType === 1 ? getText(cNode) : cNode.nodeValue;
							}
							return text;
						}
						return getText(this.nodes[0]);
					}
				}else{
					return;
				}
				return this.nodes.length > 0 ? this.nodes[0].value : undefined;
				/*var array = [];获取所有文本
				 if(typeof this.textContent == "string"){
				 this.each(function(){
				 array.push(this.textContent);//DOM3，IE9+
				 })
				 }else{
				 this.each(function(){
				 array.push(this.innerText);//DOM0
				 })
				 }
				 return array.length == 0 ? "" : array.join("");*/
			}else{
				if(typeof this.textContent == "string"){
					this.each(function(){
						this.textContent = text;
					})
				}else{
					this.each(function(){
						this.innerText = text;
					})
				}
			}
		},
		/**
		 * 获取||设置html（获取第一个节点的html||设置所有节点的html）
		 */
		html: function(value){
			if(value === undefined && value === null){
				return this.nodes.length > 0 ? this.nodes[0].innerHTML : undefined;
			}else{
				this.each(function(){
					this.innerHTML = value;
				})
			}
		},
		/**
		 * 获取||设置值（获取第一个节点的值||设置所有节点的值）
		 */
		val: function(value){
			if(value === undefined){
				return this.nodes.length > 0 ? this.nodes[0].value : undefined;
			}else{
				this.each(function(){
					this.value = value;
				})
			}
		},
		/**
		 * 设置或获取属性
		 * @param selector
		 */
		attr: function(attrName, attrValue){
			if(this.length > 0){
				if(attrValue !== undefined){
					this.each(function(){
						this.setAttribute(attrName, attrValue);
					})
				}else{
					if(this.nodes[0].getAttribute){
						return this.nodes[0].getAttribute(attrName);
					}else{
						return this.nodes[0][attrName];
					}
				}
			}
		},
		/**
		 * 删除属性
		 * @param selector
		 */
		removeAttr: function(attrName){
			if(this.length > 0){
				this.each(function(){
					this.removeAttribute(attrName);
				})
			}
		},

		//*****************DOM操作*****************
		/**
		 * 在最后一个子节点后面添加html或domNode）
		 * @param html或domNode
		 */
		append: function(param){
			if(typeof param == "string"){//不能使用innerHTML+=""的方式，因为会丢失已绑定的事件
				this.each(function(){
					this.insertAdjacentHTML("beforeend", param);
				})
			}else{
				this.each(function(){
					this.appendChild(param);
				});
			}
		},
		/**
		 * 在第一个子节点前面添加html或domNode）
		 * @param html或domNode
		 */
		prepend: function(param){
			if(typeof param == "string"){
				this.each(function(){
					this.insertAdjacentHTML("afterbegin", param);
				});
			}else{
				this.each(function(){
					this.insertBefore(param, this.firstChild);
				});
			}
		},
		/**
		 * 在当前节点前面添加html或domNode）
		 * @param html或domNode
		 */
		before: function(param){
			if(typeof param == "string"){
				this.each(function(){
					this.insertAdjacentHTML("beforebegin", param);
				});
			}else{
				this.each(function(){
					this.parentNode.insertBefore(param, this);
				});
			}
		},
		/**
		 * 在当前节点后面添加html或domNode）
		 * @param html或domNode
		 */
		after: function(param){
			if(typeof param == "string"){
				this.each(function(){
					this.insertAdjacentHTML("afterend", param);
				});
			}else{
				this.each(function(){
					if(this !== this.parentNode.lastChild){
						this.parentNode.insertBefore(param, this.nextSibling);
					}else{
						this.parentNode.appendChild(param);
					}
				});
			}
		},
		/**
		 * 删除当前节点
		 * @param selector
		 */
		remove: function(){
			this.each(function(){
				this.parentNode.removeChild(this);
			});
		},
		/**
		 * 替换，待研究
		 * @param param
		 */
		/*replaceWith: function(param){
			if(typeof param == "string"){
				var contener = document.createElement("div");
				contener.innerHTML = param;
				this.each(function(){
					this.parentNode.replaceChild(contener.firstChild.cloneNode(true), this);
				});
			}else{
				this.each(function(){
					this.parentNode.replaceChild(param.cloneNode(true), this);
				});
			}
		},*/
		empty: function(){
			this.each(function(){
				this.innerHTML = "";//此处应将后代节点绑定事件都解除，稍后实现
			});
		},

		//*****************工具*****************
		/**
		 * 无刷新异步提交表单
		 * @param form
		 * @param options
		 * Demo:
		 * swg.ajaxSubmit(document.getElementById("form"), {
				url : "./a.txt",
				method : "post",
				enctype: "multipart/form-data",
				data:{},
				success:function(data){
					alert(data)
				}
			});
		 */
		ajaxSubmit: function(options){
			this.each(function(){
				if(this.nodeName.toLowerCase() != "form"){
					alert(this+"不是form，无法进行submit");
					return;
				}
				var form = this;
				//文档中添加一个iframe
				var iframe = document.createElement("iframe");
				iframe.name = "iframe"+swg.randomInteger(10000, 99999);
				iframe.style.display = "none";
				document.body.appendChild(iframe);
				//将选项赋给form
				if(options.url){//地址
					form.action = options.url;
				}
				if(options.method){//方法
					form.method = options.method;
				}
				if(options.enctype){//编码格式
					form.enctype = options.enctype;
				}
				if(options.data){//将params.data中的参数附加到params.url后面
					for(var property in options.data){
						var value = options.data[property];
						form.action = swg.addParamToUrl(form.action, property, value);
					}
				}
				//成功回调方法
				iframe.onload = function(){
					if(options.success){
						try{
							var iframeDocument = iframe.contentWindow.document;
						}catch(error){
							if(error.name == "SecurityError"){
								alert("表单跨域提交，不能获取返回信息！"+form.action);
							}
						}
						if(iframeDocument.body) {//当返回JSON时
							options.success(iframeDocument.body.innerHTML);
						}else{//当返回XML时
							options.success(iframeDocument.documentElement.outerHTML);
						}
					}
					document.body.removeChild(iframe);
					form.target = undefined;
				}
				form.target = iframe.name;//表单的target指向iframe的name，利用iframe进行提交
				form.submit();
			});
		},
		/**
		 * 遍历节点
		 * @param handler
		 */
		each: function(handler){
			swg.each(this.nodes, handler);
		},
		/**
		 * 根据设置iframe中页面高度自动设置iframe高度
		 * @param iframeSelector
		 */
		setIframeAutoHeight: function(){
			this.each(function(){
				if(this.nodeName.toLowerCase() == "iframe"){
					var iframe = this;
					iframe[0].onload = function(){
						iframe.css("height", 0);
						var iframeHeight = parseInt(iframe[0].contentWindow.document.getElementsByTagName("body")[0].scrollHeight);
						iframe.css("height", iframeHeight + 50);
					};
				}
			})
		}
	};
	/**
	 * 为Node添加绑定事件方法
	 */
	(function(){
		var events = ["click", "dbclick", "focus", "blur", "change", "select", "keydown", "keyup", "mousedown", "mouseup", "mouseenter", "mouseleave", "mouseover", "mouseout", "mousemove", "resize", "scroll", "submit", "load", "unload", "touchstart", "touchmove", "touchend", "touchcancel", "paste"];
		for(var i in events){
			(function(event){
				addMethod(Node, event, function(handler){
					this.bindOrTrigger(event, handler);
					return this;
				});
			})(events[i]);
		}
	})();







	/**
	 * 常用工具方法
	 */
	var util = {
		//*****************异步请求*****************
		/**
		 * ajax调用当前网站后台数据
		 * @param params
		 * 例子：
		 swg.ajax({
				url: "a.txt",
				method: "get",
				async: true,
				data:{
					烦烦烦: "访问",
					wefwef: "fwef"
				},
				success: function(data){
                	debugger
				},
				error: function(error, data){
					console.error("错误：" + error + "         " + data);
				}
			});
		 */
		ajax: function(params){
			var defaultParams = {//参数默认值
				url: "",
				method: "get",
				async: true,
				data: undefined,
				header: undefined,
				success: function(){},
				error: function(){}
			}
			swg.setObjectDefaultPropertyValues(params, defaultParams);//没传的参数用默认值
			if(params.data){//将params.data中的参数附加到params.url后面
				for(var property in params.data){
					var value = params.data[property];
					if(value instanceof Array){//数组
						swg.each(value, function(){
							params.url = swg.addParamToUrl(params.url, property, this);
						})
					}else{//不是数组
						params.url = swg.addParamToUrl(params.url, property, value);
					}
				}
			}
			//添加header
			function addHeaders(xhr, params){
				if(params.header){
					for(var property in params.header){
						var value = params.header[property];
						xhr.setRequestHeader(property, value);
					}
				}
			}
			//创建XMLHttpRequest对象
			function createXhr(){
				if(window.XMLHttpRequest){
					return new XMLHttpRequest();
				}else if(window.ActiveXObject){
					var versions = ["MSXML2.XMLHttp.6.0","MSXML2.XMLHttp.5.0","MSXML2.XMLHttp.4.0","MSXML2.XMLHttp.3.0","MSXML2.XMLHttp.2.0","MSXML2.XMLHttp"];
					for(var i in versions){
						try{
							return new ActiveXObject(versions[i]);
						}catch(error){}
					}
				}else{
					alert("您的浏览器版本太低，不支持ajax.");
				}
			}
			var xhr = createXhr();
			xhr.onreadystatechange = function(){//监控xhr状态
				if(xhr.readyState === 4){
					if(xhr.status === 200){
						params.success(xhr.responseText);
					}else{
						params.error(xhr.statusText, xhr.responseText);
					}
					xhr = null;
				}
			}
			if(params.method === "get"){
				xhr.open("get", params.url, params.async);//准备好发送请求
				addHeaders(xhr, params);
				xhr.send(null);//没有时传null，因为有些浏览器需要这个参数
			}else if(params.method === "post"){
				var array = params.url.split("?");
				xhr.open("post", array[0], params.async);
				//如果不在消息头对消息体内容类型进行设置，则消息体内容类型会默认为文本。(而该设置应该在open()方法之后)
				xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
				addHeaders(xhr, params);
				xhr.send(array[1] ? array[1] : null);//取url中“？”后面的查询字符串
			}else{
				console.error("调用swg.ajax()方法传入method参数不正确")
			}
		},
		/**
		 * 跨域调用方法
		 * @param url 调用地址(String类型)
		 * @param callback 回调函数(方法引用)
		 * @param jsonp 服务器端获取回调函数名的key，不传则默认值为"callback"(String类型)
		 * Demo:
		 swg.jsonp("http://hits.17173.com/1support/support_opb.php?channel=10009&web_id=1343267821&kind=1&action=0", function(data){
				data
				debugger
			},function(){
				console.error("错误");
			}, "callback");
		 */
		jsonp: function(url, success, error, jsonp){
			var script = document.createElement("script");
			if(!jsonp){
				jsonp = "callback";
			}
			var random = swg.randomInteger(1, 10000);//随机数，为了保存结果及方法名不冲突
			var jsonpResult = swg["jsonpResult"+random];
			var saveJsonpResult = "saveJsonpResult"+random;
			swg[saveJsonpResult] = function(data){
				jsonpResult = data;
			}
			if(/\?/.test(url)){
				url = url.concat("&", jsonp, "=swg."+saveJsonpResult);
			}else{
				url = url.concat("?", jsonp, "=swg."+saveJsonpResult);
			}
			script.src = url;
			if(script.onload !== undefined){//主流
				script.onload = function(){
					if(jsonpResult !== undefined){//成功
						success(jsonpResult);
					}else{//错误
						error ? error() : 0;
					}
					script.parentNode.removeChild(script);
				}
				script.onerror = function(event){
					script.parentNode.removeChild(script);
					error ? error() : 0;//无法获取任何错误信息，event对象中没有任何可用信息
				}
			}else if(script.onreadystatechange !== undefined){//IE 5 6 7 8
				script.onreadystatechange = function(){
					if(/loaded|complete/.test(this.readyState)){//加载过程中无论是否发生异常都会进入该代码块
						if(jsonpResult !== undefined) {//成功
							success(jsonpResult);
						}else{//错误
							error();//无法获取任何错误信息，onreadystatechange事件对应方法不会获取event对象
						}
						script.parentNode.removeChild(script);
					}
				}
			}
			jsonpResult = undefined;//清空之前保留的数据
			document.getElementsByTagName("head")[0].appendChild(script);
		},
		/**
		 * 给对象的属性设置默认值
		 * @param defaultObject 包含属性默认值的对象
		 * @param targetObject 目标对象
		 */
		setObjectDefaultPropertyValues: function(targetObject, defaultObject){
			for(var property in defaultObject){
				if(targetObject[property] === undefined){
					targetObject[property] = defaultObject[property];
				}
			}
		},
		/**
		 * 请求跨域资源（需要服务器端设置资源共享方式，以Java代码为例：response.setHeader("Access-Control-Allow-Origin", "*");）
		 * 说明：XMLHttpRequest对象也能跨域，但需要奖服务器端response头部的"Access-Control-Allow-Origin"设置为XXX域名。这样XXX域下的页面才能跨域访问该资源。
		 * （其实该资源已经返回到前台页面，只不过浏览器处于安全限制，对Access-Control-Allow-Origin做了判断，如果不符合条件将报出错误）
		 * IE早先通过XDomainRequest对象进行跨域访问，访问限制同上。但到了IE11已经将该对象摒弃。
		 * 如果服务器未对资源进行设置共享，则以Chrome为例会出现如下错误：
		 * XMLHttpRequest cannot load http://shouyou.com:8081/aaaa/EFwe. No 'Access-Control-Allow-Origin' header is present on the requested resource.
		 * Origin 'http://localhost:8888' is therefore not allowed access.
		 * @param params
		 * 例子：
		 swg.cors({
				url: "http://shouyou.com:8081/aaaa/EFwe",//a.txt http://k.189.cn/common/frameworks/jquery/jquery.form.js
				method: "post",
				async: true,
				data:{
					烦烦烦: "访问",
					aaa: "fwef二房"
				},
				success: function(data){
					alert(data);
				},
				error: function(error, data){
					alert(error);
				}
			});
		 */
		cors: function(params){//只能异步
			var defaultParams = {//参数默认值
				url: "",
				method: "get",
				data: undefined,
				success: function(){},
				error: function(){}
			}
			swg.setObjectDefaultPropertyValues(params, defaultParams);//没传的参数用默认值
			if(params.data){//将params.data中的参数附加到params.url后面
				for(var property in params.data){
					var value = params.data[property];
					params.url = swg.addParamToUrl(params.url, property, value);
				}
			}
			var xhr;
			if(window.XMLHttpRequest !== undefined && "withCredentials" in (xhr = new XMLHttpRequest())){//第二个条件是XMLHttpRequest2级，表示支持跨域请求的XMLHttpRequest对象
				xhr = new XMLHttpRequest();
			}else if(window.XDomainRequest){//IE 5 6 7 8 9 10
				xhr = new XDomainRequest();
			}else{
				alert("您的浏览器不支持CORS.");
			}
			xhr.onload = function(){//XMLHttpRequest2级和XDomainRequest都支持onload事件，因XDomainRequest不支持onreadystatechange，所以只能用onload事件
				params.success(xhr.responseText);
			}
			xhr.onerror = function(){
				params.error(xhr.statusText, xhr.responseText);
			}
			if(params.method === "get"){
				xhr.open("get", params.url, true);//准备好发送请求
				xhr.send(null);//没有时传null，因为有些浏览器需要这个参数
			}else if(params.method === "post"){
				var array = params.url.split("?");
				xhr.open("post", array[0], true);
				//如果不在消息头对消息体内容类型进行设置，则消息体内容类型会默认为文本。(而该设置应该在open()方法之后)
				xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
				xhr.send(array[1] ? array[1] : null);//取url中“？”后面的查询字符串
			}else{
				console.error("调用swg.ajax()方法传入method参数不正确")
			}
		},
		/**
		 * 跨域post提交数据方法
		 * Demo:
			swg.crossDomainPost('http://localhost:8080/aaa/AAA', {
				haha: 'wefwefwfewfwe',
				gaga: 'fffffffffffff方法'
			}, function(){
				 alert('成功');
			});
		 */
		crossDomainPost: function(url, data, success){
			//iframe
			var iframe = document.createElement('iframe');
			iframe.name = 'crossDomainPost' + swg.randomInteger(100, 10000);
			iframe.style.display = "none";
			document.body.appendChild(iframe);

			//form
			var form = document.createElement("form");
			form.target = iframe.name;
			form.method = 'post';
			form.action = url;
			for(var property in data){
				var input = document.createElement('input');
				input.type = 'hidden';
				input.name = property;
				input.value = data[property];
				form.appendChild(input);
			}
			document.body.appendChild(form);

			//submit
			iframe.onload = success;
			form.submit();
		},

		//*****************工具方法*****************
		/**
		 * 判断正数
		 * @param n 被判断的数字
		 * @return {boolean}
		 */
		isPositiveInteger: function(n){
			return (n && n.toString().match(/^\d+$/)) ? true : false;
		},
		/**
		 * 校验身份证。用法：swg.checkIdCard.check()
		 */
		checkIdCard: {
			cityArray: {
				11: "北京", 12: "天津", 13: "河北", 14: "山西", 15: "内蒙古", 21: "辽宁", 22: "吉林", 23: "黑龙江", 31: "上海", 32: "江苏", 33: "浙江", 34: "安徽", 35: "福建", 36: "江西", 37: "山东", 41: "河南", 42: "湖北", 43: "湖南", 44: "广东", 45: "广西", 46: "海南", 50: "重庆", 51: "四川", 52: "贵州", 53: "云南", 54: "西藏", 61: "陕西", 62: "甘肃", 63: "青海", 64: "宁夏", 65: "新疆", 71: "台湾", 81: "香港", 82: "澳门", 91: "国外"
			},
			regExp: /^(\d{6})(\d{4})([01]\d)([0123]\d)(\d{3})(\d|x|X)?$/,
			check: function(value) {
				if(!this.regExp.test(value)) return false;
				if(!this.isValidCity(value)) return false;
				if(!this.isValidBirth(value)) return false;
				if(!this.isValidCheckDigit(value)) return false;
				return true;
			},
			isValidCity: function(value){
				var city = value.substring(0, 2);
				return !!swg.checkIdCard.cityArray[parseInt(city)];
			},
			isValidBirth: function(value) {
				var year, month, day;
				if (value.length == 18) {
					year = value.substring(6, 10);
					month = value.substring(10, 12);
					day = value.substring(12, 14);
				} else if (value.length == 15) {
					year = "19" + value.substring(6, 8);
					month = value.substring(8, 10);
					day = value.substring(10, 12);
				} else
					return false;

				if (year < 1900)
					return false;
				if (month > 12 || month < 1)
					return false;
				if (day > 31 || day < 1)
					return false;

				try {
					var birth = new Date(year, month, day);
					var current = new Date();

					return birth.getTime() < current.getTime();
				} catch (e) {
					return false;
				}
			},
			isValidCheckDigit: function(value) {
				if (value.length == 18) {
					var weightArray = [ 7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2 ];
					var checkArray = [ '1', '0', 'X', '9', '8', '7', '6', '5', '4', '3',
						'2' ];

					var sum = 0;
					for ( var i = 0; i < 17; i++) {
						sum += value.substring(i, i + 1) * weightArray[i];
					}
					var checkDigit = checkArray[sum % 11];
					return checkDigit == value.substring(17, 18);
				}
			}
		},
		/**
		 * 判断中文名
		 * @param name 名字
		 * @return
		 */
		checkChineseName: function(name){
			return (name && name.toString().match(/^[\u4E00-\u9FA5\uf900-\ufa2d]+$/)) ? true : false;
		},
		/**
		 * 添加收藏
		 */
		addFavorite: function() {
			var url = location.href;
			var title = document.getElementsByTagName("title")[0].innerText;
			try{
				window.external.addFavorite(url, title);
			}catch(e) {
				try{
					window.sidebar.addPanel(title, url, "");
				}catch (e) {
					alert("加入收藏失败，请使用Ctrl+D进行添加,或手动在浏览器里进行设置.");
				}
			}
		},
		/**
		 * 检查网络资源是否存在
		 * @param url	资源地址
		 */
		checkResExist: function(url){
			var result;
			$.ajax({
				url : url,
				type : "get",
				cache : false,
				async : false,
				dataType : "text",
				data: {

				},
				traditional: true,
				success : function(data, textStatus){
					result = true;
				},
				error : function(XMLHttpRequest, textStatus, errorThrown){
					result = false;
				}
			});
			return result;
		},
		/**
		 * 使所有input元素的placeHolder属性兼容
		 */
		makePlaceHolderCompatible: function(){
			if(navigator.userAgent.indexOf("MSIE 9.0") !== -1 || navigator.userAgent.indexOf("MSIE 8.0") !== -1){
				var $input = swg("input[placeHolder!='']");
				$input.focus(function(){
					if(swg(this).val() == swg(this).attr("placeHolder")){
						swg(this).val("");
						swg(this).removeClass("place_holder_text_color");
					}
				});
				$input.blur(function(){
					if(swg(this).val() == ""){
						swg(this).val(swg(this).attr("placeHolder"));
						swg(this).addClass("place_holder_text_color");
					}
				});
				$input.blur();
			}
		},
		/**
		 * 判断字符串是否以某个字符串结尾
		 * @param str
		 * @param endStr
		 * @return
		 */
		stringEndWith: function(str, endStr){
			return (str.lastIndexOf(endStr) == (str.length - endStr.length));
		},
		/**
		 * 获取low-high区间的数字
		 * @param low
		 * @param high
		 * @return
		 */
		randomFloat: function(min, max){
			return Math.random()*(max-min)+min;
		},
		randomInteger: function(min, max){
			return Math.floor(swg.randomFloat(min, max));
		},
		/**
		 * 交换数组元素位置
		 * @param array
		 * @param index1
		 * @param index2
		 */
		exchangeArrayElementPosition: function(array, index1, index2){
			if(index1 > index2){
				var temp = index1;
				index1 = index2;
				index2 = temp;
			}
			var temp = array[index2];
			for(var i=index2;i<index1;i++){
				array[i] = array[i+1];
			}
			array[index1] = temp;
		},
		/**
		 * 获取页面地址栏的参数
		 * @param name
		 */
		getParam: function(name, href){
			href = href || location.href;
			if(href.indexOf("?") === -1) return;
			var search = href.split("?")[1];
			var array = search.split("&");
			for(var i in array){
				var map = array[i].split("=");
				if(map[0] == name){
					return map[1];
				}
			}
		},
		/**
		 * 获取event
		 * @param event
		 * @returns {*}
		 */
		getEvent: function(event){
			return event ? event : window.event;
		},
		/**
		 * 获取触发事件的元素的引用
		 * @param event 事件对象
		 * @returns target 触发事件的元素的引用
		 */
		getTarget: function(event){
			event = swg.getEvent(event);
			if(event.target){
				return event.target;
			}else{
				return event.srcElement;//IE 6 7 8 9 10
			}
		},
		/**
		 * 阻止事件的默认行为
		 * @param event
		 */
		preventDefault: function(event){
			event = swg.getEvent(event);
			if(event.preventDefault){
				event.preventDefault()
			}else{
				event.returnValue = false;//IE 5 6 7 8 9 10
			}
		},
		/**
		 * 获取键盘码
		 * @param event
		 */
		getKeyCode: function(event){
			event = swg.getEvent(event);
			return event.keyCode || event.charCode;
		},
		/**
		 * 阻止事件向上冒泡行为
		 * @param event
		 */
		stopPropagation: function(event){
			event = swg.getEvent(event);
			if(event.stopPropagation){
				event.stopPropagation();
			}else{
				event.cancelBubble = true;//IE 6 7 8 9 10
			}
		},
		/**
		 * 断言方法，如果条件不成立，则抛出错误
		 * @param condition
		 * @param message
		 */
		assert: function(condition, message){
			if(!condition){
				throw new Error(message);
			}
		},
		initAutoRootSize: function(){
			swg.addEvent(window, "load", function(){
				function resetRem(){
					var ratio = 16;//iphone 4,root初始大小为24px
					var viewPortWidth = document.documentElement.clientWidth;//window.screen.width;不准//document.getElementsByTagName("body")[0].clientWidth;
					document.getElementsByTagName("html")[0].style.fontSize = (viewPortWidth / ratio) + "px";
				}
				resetRem();
				window.onresize = resetRem;
			});
		},
		/**
		 * 获取body右侧滚动条上方距离
		 * @returns {*|number}
		 */
		getBodyScrollTop: function(){
			var bodyScrollTop = document.getElementsByTagName("body")[0].scrollTop;//主流chrome safari opera，是在body上滚动
			var documentElementScrollTop = document.documentElement.scrollTop;//IE firefox 360，是在html上滚动
			return bodyScrollTop || documentElementScrollTop;
		},
		/**
		 * 加载屏幕内的图片
		 * 条件1：img元素设置了data-src
		 * 条件2：img的offsetTop小于屏幕底部的offsetTop，目前只适用于dom2以上
		 */
		loadLazyImg: function(){
			var viewHeightPlusScrollTop = swg.getBodyScrollTop() + document.documentElement.clientHeight;
			var imgs = document.querySelectorAll("img[data-src]");
			for(var i in imgs){
				var img = imgs[i];
				if(swg.getOffsetTop(img) < viewHeightPlusScrollTop){
					img.setAttribute("src",img.getAttribute("data-src"));
					img.src = img.getAttribute("data-src");
					img.removeAttribute("data-src");
				}
			}
		},
		/**
		 * 获取节点顶部距离文档html根节点顶部的距离
		 * @param node dom节点
		 * @returns {number}
		 * 说明：在IE8+和各主流浏览器中，dom.offsetTop是距离文档html根节点顶部的距离，在IE7及以下是距离父元素的距离。故做此兼容性处理
		 */
		getOffsetTop: function(node){
			var offsetTop = 0;
			for(;node.offsetParent;node = node.offsetParent){
				offsetTop += node.offsetTop;
			}
			return offsetTop;
		},
		/**
		 * 获取节点左侧距离文档html根节点左侧的距离
		 * @param node dom节点
		 * @returns {number}
		 * 说明：在IE8+和各主流浏览器中，dom.offsetTop是距离文档html根节点顶部的距离，在IE7及以下是距离父元素的距离。故做此兼容性处理。
		 */
		getOffsetLeft: function(node){
			var offsetLeft = 0;
			for(;node.offsetParent;node = node.offsetParent){
				offsetLeft += node.offsetLeft;
			}
			return offsetLeft;
		},
		/**
		 * 设置data-src的图片为懒加载
		 */
		initLoadLazyImg: function(){
			swg(window).bind("scroll", swg.loadLazyImg);
			swg(window).bind("load", swg.loadLazyImg);
			swg.loadLazyImg();
		},
		/**
		 * 时间格式化
		 * @param date 日期对象|时间戳数字|时间戳字符串
		 * @param format 格式化字符串
		 * @returns {String}
		 * Demo: swg.dateFormat(new Date(), "yyyy-MM-dd HH:mm:ss:SSS);
		 */
		dateFormat: function(date, format) {
			if(date instanceof Date){
			}else if(typeof date === 'number'){
				date = new Date(date);
			}else if(Object.prototype.toString.call(date) === '[object String]'){
				date = new Date(parseInt(date));
			}else{
				return "";
			}
			if(!format){
				format = "yyyy-MM-dd HH:mm:ss";
			}
			var year = new String(date.getFullYear());
			var month = swg.oneTo2Digits(new String(date.getMonth() + 1));
			var dat = swg.oneTo2Digits(new String(date.getDate()));
			var hour = swg.oneTo2Digits(new String(date.getHours()));
			var minute = swg.oneTo2Digits(new String(date.getMinutes()));
			var second = swg.oneTo2Digits(new String(date.getSeconds()));
			var milliSeconds = new String(date.getMilliseconds());
			format = format.replace(/yyyy/g, year).replace(/yyy/g, year.substr(-3)).replace(/yy/g, year.substr(-2)).replace(/y/g, year.substr(-1));
			format = format.replace(/MM/g, month).replace(/M/g, month.substr(-1));
			format = format.replace(/dd/g, dat).replace(/d/g, dat.substr(-1));
			format = format.replace(/HH/g, hour).replace(/H/g, hour.substr(-1));
			format = format.replace(/mm/g, minute).replace(/m/g, minute.substr(-1));
			format = format.replace(/ss/g, second).replace(/s/g, second.substr(-1));
			format = format.replace(/SSS/g, milliSeconds).replace(/SS/g, month.substr(-2)).replace(/S/g, milliSeconds.substr(-1));
			return format;
		},
		oneTo2Digits: function(num){
			var num = new String(num);
			if(num.length == 1){
				return "0" + num;
			}
			return num;
		},
		/**
		 * 设置cookie
		 * @param key {string} 键
		 * @param value {string} 值
		 * @param expires {number} 过期时间
		 * @param path {string} 路径
		 * @param domain {string} 域
		 * @param secure {boolean} 为true时只有https协议下的请求才发送cookie
		 */
		setCookie: function(key, value, path, expires, domain, secure){
			return document.cookie = [
				encodeURIComponent(key) + "=" + encodeURIComponent(value),
				path ? ("; path=" + path) : "",
				(typeof expires == "number") ? ("; expires=" + (new Date(new Date().getTime() + expires)).toUTCString()) : "",
				domain ? ("; domain=" + domain) : "",
				secure ? ("; secure") : ""
			].join("");
		},
		/**
		 * 获取cookie
		 * @param key
		 * @returns {*}
		 */
		getCookie: function(key){
			key = encodeURIComponent(key);
			var array = document.cookie.split("; ");
			for(var i=0;i<array.length;i++){
				var temp = array[i].split("=");
				if(temp[0] == key){
					return decodeURIComponent(temp[1]);
				}
			}
		},
		/**
		 * 删除cookie
		 * @param key
		 * @param path
		 * @param domain
		 * @param secure
		 */
		deleteCookie: function(key, path, domain, secure){
			swg.setCookie(key, null, path, -10000000, domain, secure);
		},
		addParamToUrl: function(url, key, value){
			if(/\?/.test(url)){
				url = url.concat("&");
			}else{
				url = url.concat("?");
			}
			return url.concat(encodeURIComponent(key), "=", encodeURIComponent(value));
		},
		/**
		 * 判断节点是否含有class
		 * @param node
		 * @param className
		 * @returns {boolean}
		 */
		hasClass: function(node, className){
			if(!node.className) return;
			var array = node.className.split(" ");
			for(var i in array){
				if(array[i] == className){
					return true;
				}
			}
		},
		/**
		 * 获取nodeType=1的node数组（选择器依赖方法）
		 * （原生dom操作获取node集合时，往往会获取一些文本节点和无用的方法，这些是我们不需要的，所以要去掉）
		 * @param list
		 * @returns {Array}
		 */
		nodeListToNodeArray: function(nodeList){
			var nodeArray = [];
			for(var i=0;i<nodeList.length;i++){
				var node = nodeList[i];
				if(node.nodeType === 1){
					nodeArray.push(node);
				}
			}
			return nodeArray;
		},
		/**
		 * 数组去重（选择器依赖方法）
		 * @param array
		 */
		removeRepeat: function(array){
			for(var i=0;i<array.length-1;i++){
				for(var j=i+1;j<array.length;j++){
					if(array[i] === array[j]){
						array.splice(j, 1);
						j --;
					}
				}
			}
			return array;
		},
		/**
		 * 遍历数组（选择器依赖方法）
		 * @param array
		 * @param handler
		 */
		each: function(array, handler){
			if(array && array.length){
				for(var i=0;i<array.length;i++){
					handler.call(array[i], i);
				}
			}
		},
		/**
		 * 去除字符串前后的空白符（因IE8及其以下版本String类型的原型中没有trim()方法，所以在此实现）
		 * @param str
		 * @returns {XML|void|string}
		 */
		trim: function(str){
			return str.replace(/(^\s*)|(\s*$)/g, "");
		},
		mergeArray: function(arrayA, arrayB){
			for(var i=0;arrayB && i<arrayB.length;i++){
				arrayA.push(arrayB[i]);
			}
			return arrayA;
		},
		getNodesChildren: function(nodes){
			var result = [];
			swg.each(nodes, function(){
				result = swg.mergeArray(result, this.childNodes);
			})
			return result;
		},
		getNodesDescendants: function(nodes){
			var result = [];
			swg.each(nodes, function(){
				var childNodes = this.childNodes;
				result = swg.mergeArray(result, childNodes);
				if(childNodes && childNodes.length > 0){
					result = swg.mergeArray(result, swg.getNodesDescendants(childNodes));
				}
			})
			return result;
		},
		/*获取浏览器距屏幕左侧距离*/
		getScreenLeft: function(){
			return typeof window.screenLeft == "number" ? window.screenLeft : window.screenX;
		},
		/*获取浏览器距屏幕顶部距离*/
		getScreenTop: function(){
			return typeof window.screenTop == "number" ? window.screenTop : window.screenY;
		},
		/*获取视口宽度*/
		getViewPortWidth: function(){
			var width = window.innerWidth;//IE 9+ 主流
			if(typeof width != "number"){
				if(document.compatMode == "CSS1Compat"){//IE 7 8
					width = document.documentElement.clientWidth;
				}else{
					width = document.body.clientWidth;
				}
			}
			return width;
		},
		/*获取视口高度*/
		getViewPortHeight: function(){
			var height = window.innerHeight;//IE 9+ 主流
			if(typeof height != "number"){
				if(document.compatMode == "CSS1Compat"){//IE 7 8
					height = document.documentElement.clientHeight;
				}else{
					height = document.body.clientHeight;
				}
			}
			return height;
		},
		isIE678: function(){
			var obj = {
				toString: function(){}
			};
			for(var i in obj){
				if(i == "toString"){
					return false;
				}
			}
			return true;
		},
		bodyAppendScript: function(url){
			var script = document.createElement("script");
			script.type = "text/javascript";
			script.src = url;
			document.body.appendChild(script);
		},
		headAppendLink: function(url){
			var link = document.createElement("link");
			link.rel = "stylesheet";
			link.type = "text/css";
			link.href = url;
			var head = document.getElementsByTagName("head")[0];
			head.appendChild(link);
		},
		pxToNum: function(px){
			if(px === ""){
				return 0;
			}else{
				return px.replace("px", "") * 1;
			}
		},
		numToPx: function(num){
			return num + "px";
		},
		/**
		 * 获取事件的相关元素
		 * @param event
		 */
		getEventRelatedTarget: function(event) {
			if (event.relatedTarget) {
				return event.relatedTarget;
			} else if (event.toElement) {
				return event.toElement;
			} else if (event.fromElement) {
				return event.fromElement;
			} else {
				return null;
			}
		},
		isAndroid: function(){
			return navigator.userAgent.indexOf("Android") != -1;
		},
		isIos: function(){
			return navigator.userAgent.indexOf("iPhone") != -1;
		},
		getDescendantNodes: function(node){
			var array = [];
			swg.each(node.childNodes, function(){
				if(this.nodeType === 1){
					array.push(this);
					var descendantNodes = swg.getDescendantNodes(this);
					if(descendantNodes){
						array = array.concat(descendantNodes);
					}
				}
			})
			return array;
		},
		/**
		 * base64编码
		 * @param {Object} str
		 */
		base64EncodeChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
		base64DecodeChars: new Array(-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1),
		base64encode: function(str){
			var out, i, len;
			var c1, c2, c3;
			len = str.length;
			i = 0;
			out = "";
			while (i < len) {
				c1 = str.charCodeAt(i++) & 0xff;
				if (i == len) {
					out += this.base64EncodeChars.charAt(c1 >> 2);
					out += this.base64EncodeChars.charAt((c1 & 0x3) << 4);
					out += "==";
					break;
				}
				c2 = str.charCodeAt(i++);
				if (i == len) {
					out += this.base64EncodeChars.charAt(c1 >> 2);
					out += this.base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
					out += this.base64EncodeChars.charAt((c2 & 0xF) << 2);
					out += "=";
					break;
				}
				c3 = str.charCodeAt(i++);
				out += this.base64EncodeChars.charAt(c1 >> 2);
				out += this.base64EncodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
				out += this.base64EncodeChars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
				out += this.base64EncodeChars.charAt(c3 & 0x3F);
			}
			return out;
		},
		/**
		 * base64解码
		 * @param {Object} str
		 */
		base64decode: function(str){
			var c1, c2, c3, c4;
			var i, len, out;
			len = str.length;
			i = 0;
			out = "";
			while (i < len) {
				/* c1 */
				do {
					c1 = this.base64DecodeChars[str.charCodeAt(i++) & 0xff];
				}
				while (i < len && c1 == -1);
				if (c1 == -1)
					break;
				/* c2 */
				do {
					c2 = this.base64DecodeChars[str.charCodeAt(i++) & 0xff];
				}
				while (i < len && c2 == -1);
				if (c2 == -1)
					break;
				out += String.fromCharCode((c1 << 2) | ((c2 & 0x30) >> 4));
				/* c3 */
				do {
					c3 = str.charCodeAt(i++) & 0xff;
					if (c3 == 61)
						return out;
					c3 = this.base64DecodeChars[c3];
				}
				while (i < len && c3 == -1);
				if (c3 == -1)
					break;
				out += String.fromCharCode(((c2 & 0XF) << 4) | ((c3 & 0x3C) >> 2));
				/* c4 */
				do {
					c4 = str.charCodeAt(i++) & 0xff;
					if (c4 == 61)
						return out;
					c4 = this.base64DecodeChars[c4];
				}
				while (i < len && c4 == -1);
				if (c4 == -1)
					break;
				out += String.fromCharCode(((c3 & 0x03) << 6) | c4);
			}
			return out;
		},
		/**
		 * 根据html页面代码建立document，当后台接口返回html时，可以对html进行DOM操作
		 * @param html
		 * @returns {*|swg.Node}
		 * 用法：
			var $document = swg.createHtmlDocument(html);
			$document.find(".content");
		 */
		createHtmlDocument: function(html){
			var div = document.createElement("div");
			div.innerHTML = html;
			return swg(div);
		},
		/**
		 * 在onpaste事件中获取剪贴板数据
		 * @param event
		 * @returns {string}
		 */
		getClipboardData: function(event){
			event = swg.getEvent(event);
			return event.clipboardData ? event.clipboardData.getData("Text") : window.clipboardData.getData("Text");
		},
		cssToCamel: function(cssName){
			return cssName ? cssName.toString().replace(/-(\w)/g, function(match, a, pos, originalText){
				return a.toUpperCase();
			}) : undefined;
		},
		/* 一些常用正则
		 "*":/[\w\W]+/,
		 "*6-16":/^[\w\W]{6,16}$/,
		 "n":/^\d+$/,
		 "n6-16":/^\d{6,16}$/,
		 "s":/^[\u4E00-\u9FA5\uf900-\ufa2d\w\.\s]+$/,
		 "s6-18":/^[\u4E00-\u9FA5\uf900-\ufa2d\w\.\s]{6,18}$/,
		 "p":/^[0-9]{6}$/,
		 "m":/^13[0-9]{9}$|14[0-9]{9}|15[0-9]{9}$|18[0-9]{9}$/,
		 "e":/^\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/,
		 "url":/^(\w+:\/\/)?\w+(\.\w+)+.*$/
		 "chinese": /\u4E00-\u9FA5/
		 */
		isEmail: function(value){
			return /^\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/.test(value);
		},
		isMobile: function(value){
			return /^13[0-9]{9}$|14[0-9]{9}|15[0-9]{9}$|18[0-9]{9}$/.test(value);
		},
		isQQ: function(value){
			return /^\d{5,13}$/.test(value);
		},
		/*获取节点translateX的值*/
		getTranslateX: function(node){
			return node.style.transform ? /translateX\(([^)]*)px\)/.exec(node.style.transform)[1] * 1 : 0;
		},
		/*获取节点translateX的值*/
		getTranslateY: function(node){
			return node.style.transform ? /translateY\(([^)]*)px\)/.exec(node.style.transform)[1] * 1 : 0;
		},
		isString: function(str){
			return typeof str === "string" || str instanceof String;
		},
		isArray: function(o){
			//兼容性问题（o为undefined、null时报错）
			//return o.constructor == Array;

			//兼容性问题（o不能为跨iframe传递的数组对象）
			//return o instanceof Array;

			//兼容性最好
			/*
			 ECMA-262 写道
                 Object.prototype.toString( ) When the toString method is called, the following steps are taken:
                 1.Get the [[Class]] property of this object.
                 2.Compute a string value by concatenating the three strings “[object “, Result (1), and “]”.
                 3.Return Result (2)
                 上面的规范定义了Object.prototype.toString的行为：首先，取得对象的一个内部属性[[Class]]，然后依据这个属性，返回一个类似于"[object Array]"的字符串作为结果（看过ECMA标准的应该都知道，[[]]用来表示语言内部用到的、外部不可直接访问的属性，称为“内部属性”）。利用这个方法，再配合call，我们可以取得任何对象的内部属性[[Class]]，然后把类型检测转化为字符串比较，以达到我们的目的。还是先来看看在ECMA标准中Array的描述吧。
			 ECMA-262 写道
                 new Array([ item0[, item1 [,…]]])
                 he [[Class]] property of the newly constructed object is set to “Array”.
			 */
			return Object.prototype.toString.call(o) === "[object Array]";
		}
	};

	/**
	 * 选择器
	 * @param 选择器表达式|原生node节点
	 * @returns {Node}
	 */
	var swg = function(param){
		if(param){
			if(param instanceof Function){
				//函数，则绑定load事件
				var handler = param;
				var node = new Node([window]);
				return node.bind("load", handler);
			}else if(window.HTMLElement && param instanceof HTMLElement){
				//HTMLElement节点
				var domNode = param;
				return new Node([domNode]);
			}else if(param.nodeType){
				//HTMLElement节点，兼容低版本IE
				return new Node([param]);
			}else{
				//字符串，用选择器结果作为参数实例化核心类
				var selector = param.toString();
				return new Node(Sizzle(selector));
			}
		}else{
			return new Node([]);
		}
	};

	//将util单体的方法附给swg
	for(var i in util){
		swg[i] = util[i];
	}


	// UMD规范
	if (typeof define === "function" && define.amd) {
		define(function () {
			return swg;
		});
	// swg requires that there be a global window in Common-JS like environments
	} else if (typeof module !== "undefined" && module.exports) {
		module.exports = swg;
	} else {
		window.swg = swg;
	}
	// EXPOSE

})();

/*文档加载完毕后执行相应方法，如以下代码中需要jQuery*/
/*
(function(){
	var onload = window.onload;
	window.onload = function(){
		if(onload){
			onload();
		}
		//执行代码...

	}
})();
*/



})();
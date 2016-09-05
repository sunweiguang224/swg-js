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
		 * Demo: swg.dateFormat(new Date(), 'yyyy-MM-dd HH:mm:ss SSS');
		 */
		dateFormat: function(date, format){
			date = Object.prototype.toString.call(date) == '[object String]' ? new Date(parseInt(date)) :
				Object.prototype.toString.call(date) == '[object Number]' ? new Date(date) :
				date || new Date();
			format = Object.prototype.toString.call(format) == '[object String]' ? format : 'yyyy-MM-dd hh:mm:ss SSS';
			var map = {
				'y': date.getFullYear(),
				'M': date.getMonth() + 1,
				'd': date.getDate(),
				'H': date.getHours(),
				'm': date.getMinutes(),
				's': date.getSeconds(),
				'S': date.getMilliseconds()
			};
			for(var key in map){
				format = format.replace(new RegExp(key + '+'), function(matchValue, index, input){
					return swg.beforeFillZero(map[key], matchValue.length);
				});
			}
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
		 * 前补0
		 * @param value {Number|String} 格式化字符串
		 * @param digit 位数
		 * @returns {String}
		 */
		beforeFillZero: function(value, digit){
			value = value.toString();
			var zeroNum = digit - value.length;
			for(var i=0;i<zeroNum;i++){
				value = '0' + value;
			}
			return value;
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


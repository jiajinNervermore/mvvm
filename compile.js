class Compile {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el)
    this.vm = vm
    if (this.el) {
      //如果这个元素能获取到，我们才开始编译
      //1.先把这些真实的DOM移入到内存中，文档碎片 fragment
      let fragment = this.node2fragment(this.el)
      //2. 编译 => 提取想要的元素节点 v-model和文本节点 {{}}
      this.compile(fragment)
      //3.把编译好的fragment再塞回到页面中去
      this.el.appendChild(fragment)
    }
  }
  // 专门写一些辅助方法
  isElementNode(node) {
    return node.nodeType === 1
  }
  // 判断是不是指令
  isDirective(name) {
    return name.includes('v-')
  }
  // 核心方法
  compileElement(node) {
    //带v-model的 v-text v-if ...
    let attrs = node.attributes;//取出当前节点的属性
    Array.from(attrs).forEach(attr => {
      console.log(attr.name)
      let attrName = attr.name
      //如果属性中带有v-
      if (this.isDirective(attrName)) {
        // 取到对应的值放到节点中
        let expr = attr.value
        let [, type] = attrName.split('-')//截取v-model 中的model 就是去掉v-
        CompileUtil[type](node, this.vm, expr)
      }
    })
  }
  compileText(node) {
    //带{{}}的
    let expr = node.textContent//取文本中的内容
    let reg = /\{\{([^}]+)\}\}/g //{{a}} {{b}}{{c}}
    if (reg.test(expr)) {
      // node this.vm.$data text
      CompileUtil['text'](node, this.vm, expr)
    }
  }
  compile(fragment) {
    let childNodes = fragment.childNodes;
    //需要递归
    //将childNodes转为数组进行遍历，判断是元素节点还是文本节点
    Array.from(childNodes).forEach(node => {
      if (this.isElementNode(node)) {
        //是元素节点 递归遍历 这里需要编译元素
        this.compileElement(node)
        this.compile(node)
      } else {
        //文本节点
        //这里需要编译文本
        this.compileText(node)

      }
    })
  }
  // 核心的方法
  node2fragment(el) {
    //需要将el全部放到内存中
    //文档碎片
    let fragment = document.createDocumentFragment()
    let firstChild;
    //每次取第一个子节点 放入到文档片段中
    while (firstChild = el.firstChild) {
      fragment.appendChild(firstChild)
    }
    return fragment //内存中的节点
  }
}
//
CompileUtil = {
  getVal(vm, expr) {//获取实例上对应的数据
    expr = expr.split('.')//[a,b,c,d,e]
    return expr.reduce((prev, next) => {
      //vm.$data.a
      return prev[next]
    }, vm.$data)
  },
  getTextVal(vm, expr) {
    return expr.replace(/\{\{([^}]+)\}\}/g, (...args) => {
      console.log('调用赋值')
      return this.getVal(vm, args[1])

    })
  },
  text(node, vm, expr) {//文本处理
    let updateFn = this.updater['textUpdater']
    let value = this.getTextVal(vm, expr)
    // "message.a" = > [message.a] vm.$data.message.a
    //vm.$data[expr]
    //{{message}}=>hello world

    expr.replace(/\{\{([^}]+)\}\}/g, (...args) => {
      new Watcher(vm, args[1], (newValue) => {
        //如果数据变化了，文本节点需要重新获取依赖的属性更新文本中的内容
        console.log('数据变化了')
        updateFn && updateFn(node, this.getTextVal(vm, expr))
      })
    })
    updateFn && updateFn(node, value)
  },
  setVal(vm, expr, value) {
    expr = expr.split('.')
    //收敛
    return expr.reduce((prev, next, currentIndex) => {
      if (currentIndex === expr.length - 1) {
        return prev[next] = value
      }
      return prev[next]
    }, vm.$data)
  },
  model(node, vm, expr) {
    //输入框处理
    let updateFn = this.updater['modelUpdater']
    // "message.a" = > [message.a] vm.$data.message.a
    //vm.$data[expr]
    //这里加一个监控 数据变化了 应该调用这个watch 的 callback
    new Watcher(vm, expr, (newValue) => {
      //当值变化后，会调用cb 将新的值传递过来
      updateFn && updateFn(node, this.getVal(vm, expr))
    })
    node.addEventListener('input', (e) => {
      console.log('input', expr)
      let newValue = e.target.value
      this.setVal(vm, expr, newValue)
    })
    updateFn && updateFn(node, this.getVal(vm, expr))
  },
  updater: {
    //文本更新
    textUpdater(node, value) {
      node.textContent = value
    },
    //输入框更新
    modelUpdater(node, value) {
      node.value = value
    }
  }
}
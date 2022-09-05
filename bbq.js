/**********************************************************************/
/**/ const D=document, LS=localStorage                              /**/
/**/ const $=D.querySelector.bind(D), $$=D.querySelectorAll.bind(D) /**/
/**/ const U = x => x===undefined                                   /**/
/**/ const tojson = x => U(x) ? "" : JSON.stringify(x)              /**/
/**/ const unjson = str => U(str) ? undefined : JSON.parse(str)     /**/
/**/ const db = {set: (k,v) => LS.setItem(k, tojson(v)),            /**/
/**/             get: (k) => unjson(LS.getItem(k)),                 /**/
/**/             del: (k) => LS.removeItem(k),                      /**/
/**/             raw: LS}                                           /**/
/**/ const elem = t => D.createElement(t)                           /**/
/**/ const html = (s) => {let e,d=elem('div'); d.innerHTML=s;       /**/
/**/   e=d.firstElementChild; e.remove(); return e }                /**/
/**/ const debounce = (ms, f) => {let t; return (...args) => {      /**/
/**/   clearTimeout(t); t = setTimeout(f.bind(null, ...args), ms)}} /**/
/**********************************************************************/

import * as PDF from 'https://cdn.skypack.dev/pdf-lib'
import Split from 'https://cdn.skypack.dev/split.js'
const CM = CodeMirror

const AsyncFunction = (async function(){}).constructor


// See https://codemirror.net/examples/autocompletion/
const completePropertyAfter = ["PropertyName", ".", "?."]
const dontCompleteIn = ["TemplateString", "LineComment", "BlockComment",
                        "VariableDefinition", "PropertyDefinition"]
function completeProperties(from, object) {
  let options = []
  for (let name in object) {
    options.push({
      label: name,
      type: typeof object[name] == "function" ? "function" : "variable"
    })
  }
  return { from, options, validFor: /^[\w$]*$/ }
}
function completeFromObject(obj) {
  return function(c) {
    let nodeBefore = CM.lang.syntaxTree(c.state).resolveInner(c.pos, -1)
    if (completePropertyAfter.includes(nodeBefore.name) &&
      nodeBefore.parent?.name == "MemberExpression") {
      let object = nodeBefore.parent.getChild("Expression")
      if (object?.name == "VariableName") {
        let from = /\./.test(nodeBefore.name) ? nodeBefore.to : nodeBefore.from
        let variableName = c.state.sliceDoc(object.from, object.to)
        if (typeof obj[variableName] == "object")
          return completeProperties(from, obj[variableName])
      }
    } else if (nodeBefore.name == "VariableName") {
      return completeProperties(nodeBefore.from, obj)
    } else if (c.explicit && !dontCompleteIn.includes(nodeBefore.name)) {
      return completeProperties(c.pos, obj)
    }
    return null
  }
}


function download(filename, text) {
  if (!text) { return alert('No file') }
  let a = document.createElement('a')
  a.href = `${encodeURI(text)}`
  a.download = filename
  a.target = '_blank'
  a.click()
}

window.dlcode = () => download('bbq.js', `data:text/plain,${ed.state.doc.toString()}`)
window.dlpdf = () => download('bbq.pdf', view.data)


let ed


async function init() {
  Split(['#code', '#view'], {
    gutterSize: 5,
    sizes: db.get('splitsize') || [50, 50],
    onDragEnd: sizes => db.set('splitsize', sizes)
  })

  const drawctx = {
    PDF, doc: await PDF.PDFDocument.create()
  } 

  let js = new CM.lang.LanguageSupport(CM.js.javascriptLanguage, [
    CM.js.javascriptLanguage.data.of({autocomplete: completeFromObject(drawctx)})
  ])

  ed = new CM.EditorView({
    doc: db.get('code') || `// Variables:
//    PDF: a PDFLib instance (see https://pdf-lib.js.org)
//    doc: a new PDFDocument instance`,
    extensions: [
      CM.basicSetup, js,
      CM.view.keymap.of([CM.cmd.indentWithTab]),
      CM.view.EditorView.updateListener.of(debounce(250, e => {
        db.set('code', e.state.doc.toString())
        console.log('saved')
      }))
    ],
    parent: $('#code')
  }) 

  window.draw = async function() {
    drawctx.doc = await PDF.PDFDocument.create()
    let code = `
${ed.state.doc.toString()}
;return doc
    `
    let f = new AsyncFunction(...Object.keys(drawctx), code)
    let doc = await f(...Object.values(drawctx))
    let data = await doc.saveAsBase64({dataUri: true})
    let embed = html(`<embed type="application/pdf" src="${data}"></embed>`)
    let view = $('#view')
    view.innerHTML = ''
    view.data = data
    view.append(embed)
  }
}

init()


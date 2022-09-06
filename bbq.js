/**********************************************************************/
/**/ const D=document, B=D.body, E=Element, LS=localStorage         /**/
/**/ const $=D.querySelector.bind(D), $$=D.querySelectorAll.bind(D) /**/
/**/ const U = x => x===undefined                                   /**/
/**/ const tojson = x => U(x) ? "" : JSON.stringify(x)              /**/
/**/ const unjson = str => U(str) ? undefined : JSON.parse(str)     /**/
/**/ const db = {set: (k,v) => LS.setItem(k, tojson(v)),            /**/
/**/             get: (k) => unjson(LS.getItem(k)),                 /**/
/**/             del: (k) => LS.removeItem(k),                      /**/
/**/             raw: LS}                                           /**/
/**/ const debounce = (ms, f) => {let t; return (...args) => {      /**/
/**/   clearTimeout(t); t = setTimeout(f.bind(null, ...args), ms)}} /**/
/**********************************************************************/

import * as PDF from 'https://cdn.skypack.dev/pdf-lib'
import Split from 'https://cdn.skypack.dev/split.js'
const CM = CodeMirror

window.PDF = PDF
const AsyncFunction = (async function(){}).constructor

const ua = (function() {
  const u = navigator.userAgent
  let chrome = /Chrome/.test(u)
  let safari = !chrome && /AppleWebKit/.test(u)
  let mac = /Mac/.test(navigator.platform)
  return {chrome, safari, mac}
})()

const MOD = ua.mac ? 'Cmd' : 'Ctrl'

$$('.mod').forEach(e => e.innerHTML = e.innerHTML.replace('Cmd', MOD))


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
  a.download=filename; a.target='_blank'
  a.href = `${encodeURI(text)}`
  a.click()
}

function msg(m) {
  clearTimeout(msg.t)
  let e = $('#msg')
  e.innerHTML = m
  e.classList.add('show')
  msg.t = setTimeout(() => e.classList.remove('show'), 5000)
}

window.dlcode = () => {
  download('bbq.js', `data:text/plain,${getcode()}`)
  msg('✔ Saved to your downloads as bbq.js')
}
window.dlpdf = () => {
  download('bbq.pdf', $('#view-iframe').src)
  msg('✔ Saved to your downloads as bbq.pdf')
}

window.sharecode = async () => {
  const pb = 'https://corsproxy.io/?https://envs.sh'
  let body = new FormData
  body.set('file', new File([getcode()], 'bbq.js', {type:'text/plain'}))
  let resp = await fetch(pb, {method:'POST', body})
  let url = await resp.text()
}

window.printpdf = () => {
  let iframe = $('#view-iframe')
  if (ua.safari) {
    // Safari adds a (seemingly) unavoidable bottom margin when
    // printing a PDF from an iframe. If we find a way to avoid
    // it, we can happily remove this 'if' block.
    let win = open(iframe.src, '_blank')
    setTimeout(() => { win.print(); win.close() }, 400)
  } else {
    iframe.contentWindow.print()
  }
}

D.addEventListener('keydown', e => {
  if ((e.keyCode == 83) && (ua.mac ? e.metaKey : e.ctrlKey)) {
    e.preventDefault()
    msg('👍 PDFBBQ automatically saves your work.')
  }
})


let ed

const getcode = () => ed.state.doc.toString()


async function init() {
  Split(['#code', '#view'], {
    gutterSize: 5,
    sizes: db.get('splitsize') || [50, 50],
    onDragEnd: sizes => db.set('splitsize', sizes)
  })

  const doc = await PDF.PDFDocument.create()
  const PPI = PDF.PageSizes.Letter[0] / 8.5
  const in2pt = n => n * PPI
  const pt2in = n => n / PPI
  const drawctx = {PDF, doc, PPI, pt2in, in2pt
    ,pt2cm: n => pt2in(n) * 2.54
    ,cm2pt: n => in2pt(n / 2.54)
    ,pt2mm: n => pt2in(n) * 25.4
    ,mm2pt: n => in2pt(n / 25.4)
    ,fix: n => Number(n.toFixed(3))
  }

  let js = new CM.lang.LanguageSupport(CM.js.javascriptLanguage, [
    CM.js.javascriptLanguage.data.of({autocomplete: completeFromObject(drawctx)})
  ])

  ed = new CM.EditorView({
    doc: db.get('code') || `// Variables:
//    PDF:  a PDFLib instance (see https://pdf-lib.js.org)
//    doc:  a new PDFDocument instance
//    page: the first page of the document`,
    extensions: [
      CM.view.EditorView.updateListener.of(debounce(1000, e => {
        db.set('code', getcode())
      })),
      CM.view.keymap.of([
        {key: MOD+'-Enter', run: () => {draw(); return true}},
        {key: MOD+'-p', run: () => {printpdf(); return true}},
        {key: MOD+'-s', run: () => {
          msg('👍 PDFBBQ automatically saves your work.')
          return true
        }},
      ]),
      CM.view.keymap.of([CM.cmd.indentWithTab]),
      CM.basicSetup, js,
    ],
    parent: $('#code')
  }) 

   async function do_draw() {
    drawctx.doc = await PDF.PDFDocument.create()
    let code = `
${getcode()}
;return doc
    `
    let f = new AsyncFunction(...Object.keys(drawctx), code)
    let doc = await f(...Object.values(drawctx))

    let data = await doc.save()
    let blob = new Blob([data.buffer], {type: 'application/pdf'})
    let url = URL.createObjectURL(blob)
    let iframe = $('#view-iframe')
    iframe.src = url
  }

  window.draw = showmsg => {
    ++window.draw.n
    if (showmsg && (window.draw.n < 3)) {
      msg('💁 You can also run your code using <b>'+MOD+'+Enter</b>.')
    }
    do_draw()
  }
  window.draw.n = -1

  draw()
}

init()


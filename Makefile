# CodeMirror does not work well with skypack, so we have to bundle it by hand.
# The exported object will be available as `window.CodeMirror`.
# See: https://github.com/skypackjs/skypack-cdn/issues/159
# See: https://codemirror.net/examples/bundle/

codemirror.min.js: .cm/cm.js Makefile
	@cd .cm                                                                                                    \
		; npm i --silent codemirror @codemirror/lang-javascript rollup @rollup/plugin-node-resolve terser        \
		; node_modules/.bin/rollup cm.js -f iife -n CodeMirror -p @rollup/plugin-node-resolve -o codemirror.js   \
		; node_modules/.bin/terser codemirror.js > codemirror.min.js                                             \
		; mv codemirror.min.js ..

.cm/cm.js: Makefile
	@mkdir -p .cm && cd .cm                                                                                    \
		; echo 'export * from "codemirror"' > cm.js                                                              \
		; echo 'export * as lang from "@codemirror/language"' >> cm.js                                           \
		; echo 'export * as js from "@codemirror/lang-javascript"' >> cm.js                                      \
		; echo 'export * as cmd from "@codemirror/commands"' >> cm.js                                            \
		; echo 'export * as view from "@codemirror/view"' >> cm.js                                               \

clean:
	rm -rf .cm codemirror.min.js


# vim: set tw=110

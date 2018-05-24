const iife = (input, file, name) => {
  return {
		input,
		output: {
			file,
      name,
			format: 'iife',
			sourcemap: false
		}
	}
}
export default [
	// iife , for older browsers
	iife('src/custom-pages.js', 'custom-pages.js', 'CustomPages')
]

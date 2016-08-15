
import gulp from 'gulp';
import	uglify from 'gulp-uglify';		// js压缩混淆
import	concat from 'gulp-concat';			// 文件合并 .pipe(concat('all.js'))

gulp.task('default', () => {
	gulp.src([
		'src/head.js',
		'src/sizzle.js',
		'src/swg.js',
		'src/tail.js',
	]).pipe(concat('swg.js'))
		.pipe(gulp.dest('dev'));
});

gulp.task('build', () => {
	gulp.src([
		'dev/swg.js',
	]).pipe(uglify())
		.pipe(gulp.dest('dist'));
});


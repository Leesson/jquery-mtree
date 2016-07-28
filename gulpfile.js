var gulp = require('gulp');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var rename = require('gulp-rename')

gulp.task('default', function() {
	gulp.src('client/js/**/*.js') // ƥ�� 'client/js/somedir/somefile.js' ���ҽ� `base` ����Ϊ `client/js/`
		.pipe(minify())
		.pipe(gulp.dest('build'));  // д�� 'build/somedir/somefile.js'

	gulp.src('client/js/**/*.js', { base: 'client' })
		.pipe(minify())
		.pipe(gulp.dest('build'));  // д�� 'build/js/somedir/somefile.js'
});

gulp.task('minifyjs', function() {
    return gulp.src('js/jquery-mtree.js')
        //.pipe(concat('main.js'))    //�ϲ�����js��main.js
        .pipe(gulp.dest('dist/js'))    //���main.js���ļ���
        .pipe(rename({suffix: '.min'}))   //renameѹ������ļ���
        .pipe(uglify())    //ѹ��
        .pipe(gulp.dest('dist/js'));  //���
});

// ѹ�� js �ļ�
// ��������ʹ�� gulp script ����������
gulp.task('script', function() {
    // 1. �ҵ��ļ�
    gulp.src('js/*.js')
    // 2. ѹ���ļ�
        .pipe(uglify())
    // 3. ���ѹ������ļ�
        .pipe(gulp.dest('dist/js'))
});
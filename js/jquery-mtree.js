/*
 * mtree v1.0
 * require jquery 1.4+
 */
/*
 | Copyright 2016 Lixian
 |
 | Licensed under the Apache License, Version 2.0 (the "License");
 | you may not use this file except in compliance with the License.
 | You may obtain a copy of the License at
 |
 |    http://www.apache.org/licenses/LICENSE-2.0
 |
 | Unless required by applicable law or agreed to in writing, software
 | distributed under the License is distributed on an "AS IS" BASIS,
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 | See the License for the specific language governing permissions and
 | limitations under the License.
 */
;
(function ($, window, undefined) {
    var pluginName = "mtree",
        defaults = {
            title: "",
            identify_field: "id",
            display_field: "name",
            child_field: "childs",
            addition_field: "", //节点补充说明字段，例如每个节点对应的数量
            addition_field_default: "", //节点补充说明字段默认值
            addition_field_suffix: "", //前者的描述信息，如计量单位
            theme: "blue", //skins: blue...目前只有一种，用户可以自行扩展
            close_same_level: true, //关闭同级别的树节点
            collapsed: true, //初始化状态，树节点张开或关闭。如果close_same_level=true，collapsed恒等于false
            selected: "", //初始化选择的树节点，传入identify_field值
            link_to: "",
            switch_button: true, //是否可以收起树的全部内容，只留标题,标题不为空时有效
            editable: false,
            context_menu: ['rename', 'delete', 'insert', 'add'], //insert:在节点前插入；add:添加子节点
            custom_context_menu: [],
            search_box: false,  //是否显示搜索框
            duration: 300, //节点开关速度，单位毫秒
            delay: 100, //触发后延迟时间，单位毫秒
            //expose_api: false, //
            callback: $.noop
        };

    function Mtree(element, dataList, options) {
        this.element = element;
        this.settings = $.extend({}, defaults, options);
        this.jsonTree = dataList instanceof Array ? function(settings, id) {
            var data = {};
            data[settings['identify_field']] = 'mtree_root_' + id;
            data[settings['child_field']] = dataList;
            return data;
        }(this.settings, this.element.id) : dataList;

        this.init();
    }

    Mtree.prototype = {
        name: pluginName,
        version: 'v1.0',
        defaults: defaults,
        settings: null,
        element: null,
        $treeBody: null,
        jsonTree: {},
        insertPos: {
            append: "append",
            prepend: "prepend",
            before: "before",
            after: "after"
        },
        OPERATION: {
            NEW: 0,
            RENAME: 1,
            DELETE: 2,
            SELECT: 3
        },
        contextMenuOpts: {
            name: "treeEdit",
            offsetX: 2,
            offsetY: 2,
            textLimit: 10,
            beforeShow: $.noop,
            afterShow: $.noop
        },

        menuItems: [],

        init: function () {
            var $element, $title, $switchBtn, $treeBody,
                $sDiv, $sBox, $sBtn,
                that = this,
                settings = that.settings;

            $element = $(this.element).addClass(this.settings["theme"]);
            $element.empty();

            //build dom - tree body
            $treeBody = this.$treeBody = $('<ul class="mtree"/>');
            this.buildNodes($treeBody, this.jsonTree[settings['child_field']], this.settings);

            //init dom - title
            if(this.settings["title"]) {
                $title = $('<p />').addClass("mtree-title").text(this.settings["title"]).appendTo($element);

                //on/off tree button
                if(this.settings["switch_button"]) {
                    $switchBtn = $('<span class="mtree-title-close"/>').text("×").appendTo($title);
                    $title.bind("click", function(e){
                        var node = e.target || e.srcElement;
                        if($(node).hasClass("mtree-title-close")) {
                            if($treeBody.is(":hidden")) {
                                $treeBody.show(200);
                                $element.find(".mtree-search").show(200);
                                $switchBtn.text("×");
                            } else {
                                $treeBody.hide(200);
                                $element.find(".mtree-search").hide(200);
                                $switchBtn.text("≡");
                            }
                        }
                    });
                }
            }

            //init dom - search box
            if(settings["search_box"]) {
                $sDiv = $('<div class="mtree-search"/>').appendTo($element);
                $sBox = $('<input class="mtree-search-box"/>').appendTo($sDiv);
                $sBtn = $('<span class="mtree-search-btn"/>').appendTo($sDiv);

                $sBox.bind('keydown', function(e) {
                    if(e.which == 13) {
                        that.searchNodeInEle(this.value);
                    }
                });
                $sBtn.bind('click', function() {
                    that.searchNodeInEle($sBox.val());
                });
            }

            //add tree body to element
            $element.append($treeBody);

            //init tree style
            that.initTreeStyle();

            //bind event
            that.bindOperation();

            //init select
            if(settings['selected']) {
                $treeBody.data('init-select', true);
                that.select(settings['selected'], $treeBody, settings);
            }

            //init context menu
            if(settings['editable']) {
                var initMenuItems = [],
                    menuItemOption = {
                    rename: {
                        text: "重命名",
                        func: function () {
                            that.renameNode(this);
                        }
                    },
                    deleteNode: {
                        text: "删除",
                        func: function () {
                            that.deleteNode(this);
                        }
                    },
                    addChild: {
                        text: "新建", //子节点
                        func: function () {
                            that.insertNode(this, that.insertPos.append);
                        }
                    },
                    insertBefore: {
                        text: "插入", //同级节点
                        func: function () {
                            that.insertNode(this, that.insertPos.before);
                        }
                    }
                };

                for(var i = 0; i < that.settings.context_menu.length; i++) {
                    switch (that.settings.context_menu[i]) {
                        case 'rename':
                            initMenuItems.push(menuItemOption.rename);
                            break;
                        case 'delete':
                            initMenuItems.push(menuItemOption.deleteNode);
                            break;
                        case 'insert':
                            initMenuItems.push(menuItemOption.insertBefore);
                            break;
                        case 'add':
                            initMenuItems.push(menuItemOption.addChild);
                            break;
                        default:
                            break;
                    }
                }
                that.menuItems = [];
                that.menuItems.push(initMenuItems);
                //添加用户自定义右键菜单
                if(settings['custom_context_menu'].length > 0) {
                    that.menuItems = that.menuItems.concat(settings['custom_context_menu']);
                }

                that.contextMenu();
            }
        },

        initTreeStyle: function () {
            var that = this,
                $treeBody = that.$treeBody,
                settings = that.settings,
                node = null;

            if ($treeBody.length) {
                if(settings['close_same_level']) {
                    settings['collapsed'] = true;
                }
                $treeBody.find("ul").css({
                    'overflow': 'hidden',
                    'display': settings['collapsed'] ? 'none' : 'block'
                });
                node = $treeBody.find('li:has(ul)');
                node.each(function () {
                    $(this).addClass('mtree-node mtree-' + (settings['collapsed'] ? 'closed' : 'open'));
                    $(this).children('ul').addClass('mtree-level-' + ($(this).parentsUntil($treeBody, 'ul').length + 1));
                });
            }
        },

        bindOperation: function() {
            var that = this,
                $treeBody = that.$treeBody,
                settings = that.settings,
                $node = $treeBody.find('li:has(ul)');

            if ($treeBody.length) {
                //注意两个事件的定义顺序不能颠倒，决定的回调执行的先后
                //含有子节点的节点事件
                $node.children('a:first-child').bind('click', function(e) {
                    var el = $(this).parent().children('ul').first(),
                        isOpen = $(this).parent().hasClass('mtree-open'),
                        isActive = $(this).parent().hasClass('mtree-active');

                    if(isOpen && !isActive) {
                        return;
                    }
                    that.setNodeClass($(this).parent(), isOpen);
                    el.slideToggle(settings['duration']);
                });
                //所有节点事件
                $treeBody.find('li > a:first-child').bind('click', function (e) {
                    //重复点击同一节点只执行一次回调
                    var $close_items,
                        operation, treeId,
                        index, $parentNode, $parentNodeLi, parentObj,
                        obj = null,
                        trigger = this,
                        isActive = $(this).parent().hasClass('mtree-active');

                    operation = $(this).data("operation");
                    operation = (operation == undefined ? that.OPERATION.SELECT : operation);
                    //被选中且普通选择不执行回调
                    if (!(isActive && operation == that.OPERATION.SELECT)) {
                        if(operation == that.OPERATION.NEW) {
                            $parentNodeLi = $(this).closest('ul').parent();
                            if($parentNodeLi.attr('id') == $treeBody.parent().attr('id')) {
                                //选中节点是树的根节点
                                parentObj = {
                                    data: that.jsonTree
                                };
                            } else {
                                $parentNode = $parentNodeLi.children('a:first');
                                parentObj = that.getObjById(that.jsonTree, $parentNode.attr("id"), settings);
                            }

                            if(parentObj instanceof Object) {
                                obj = {
                                    'parent': parentObj['data'],
                                    'data': null,
                                    'index': $(this).data('index'),
                                    'text': $(this).text()
                                }
                            } else {
                                throw new Error("not find selected node's parent node.");
                            }
                        } else if(operation == that.OPERATION.RENAME) {
                            obj = that.getObjById(that.jsonTree, $(this).attr("id"), settings);
                            obj['text'] = $(this).text();
                        } else {
                            obj = that.getObjById(that.jsonTree, $(this).attr("id"), settings);
                        }

                        var modifyNodeFunc = function(jsonNode) {
                            //update tree data
                            obj['parent'][settings['child_field']].splice(obj['index'], 0, jsonNode);
                            //update tree dom
                            that.modifyNode.call(trigger, jsonNode, settings);
                        };

                        //初始化树选中不执行回调
                        var optResult = false;
                        if($treeBody.data('init-select')) {
                            $treeBody.removeData('init-select');
                        } else {
                            optResult = settings.callback.call(this, obj, operation, modifyNodeFunc);

                            if(!optResult) {
                                //that.showInfo($treeBody, '操作失败');
                                if(operation == that.OPERATION.NEW) {
                                    //添加失败，移除添加
                                    var $li = $(this).parent();
                                    if($li.closest('ul').children('li').length > 1) {
                                        $li.remove();
                                    } else {
                                        $li.closest('ul').parent().removeClass('mtree-node').removeClass('mtree-open').removeClass('mtree-close');
                                        $li.closest('ul').remove();
                                    }
                                } else if(operation == that.OPERATION.RENAME) {
                                    //重命名失败，还原之前的名称
                                    $(this).text($(this).data('text'));
                                }
                            } else {
                                if(operation == that.OPERATION.NEW) {
                                    //在 modifyNodeFunc 函数中执行
                                } else if(operation == that.OPERATION.RENAME) {
                                    obj['data'][settings['display_field']] = obj['text'];
                                } else {
                                    //select 无需编辑数据
                                }
                            }
                        }

                        $(this).removeData("operation");
                        $(this).removeData('index');
                        $(this).removeData('text');
                    }

                    //关闭其他打开项。避免重复执行
                    if (settings['close_same_level'] && !isActive) {
                        $close_items = $treeBody.find('.mtree-open').not($(this).parents('li'));
                        //var close_items = $(this).closest('ul').children('.mtree-open').not($(this).parent()).children('ul');

                        if($close_items.length) {
                            $close_items.children('ul').delay(settings['delay']).slideToggle(settings['duration'], function () {
                                that.setNodeClass($close_items, true);
                            });
                        }
                    }

                    $(this).parent().addClass('mtree-active');
                    $treeBody.find('.mtree-active').not($(this).parent()).removeClass('mtree-active');
                });
            }
        },

        unbindOperation: function() {
            var that = this,
                $treeBody = that.$treeBody,
                $node = $treeBody.find('li:has(ul)');

            $node.children('a:first-child').unbind('click');
            $treeBody.find('li > a:first-child').unbind('click');
        },

        setNodeClass: function (el, isOpen) {
            if (isOpen) {
                el.removeClass('mtree-open').addClass('mtree-closed');
            } else {
                el.removeClass('mtree-closed').addClass('mtree-open');
            }
        },

        //构造树结构，也可用于批量添加节点
        buildNodes: function (parent, list, settings) {
            var callee = arguments.callee;
            $.each(list, function (index, val) {
                var li = $('<li/>').appendTo(parent),
                    a = $('<a/>').text(val[settings["display_field"]])
                        .attr("href", settings['link_to'] ? settings['link_to'].replace(/__id__/, val[settings["identify_field"]]) : "javascript:void(0);")
                        .attr("id", val[settings["identify_field"]])
                        .appendTo(li);
                if(settings["addition_field"]) {
                    a.append($('<span class="node-data-num"/>').text((val[settings["addition_field"]] || settings['addition_field_default']) + (val[settings["addition_field_suffix"]] || '')));
                }

                if (val[settings["child_field"]] && val[settings["child_field"]].length > 0) {
                    var ul = $('<ul/>').appendTo(li);
                    callee(ul, val[settings["child_field"]], settings);
                }
            });

            return parent;
        },

        searchNodeInEle: function (text) {
            var that = this,
                $treeBody = that.$treeBody;
            if(text) {
                var settings = that.settings,
                    arr = that.getEleByInnerText($treeBody, text),
                    selectedNum;
                if(arr.length > 0) {
                    that.showInfo($treeBody, "共搜索到" + arr.length + "个节点");
                    if(settings["close_same_level"]) {
                        selectedNum = 1;
                    } else {
                        selectedNum = arr.length;
                    }

                    for(var i = 0; i < selectedNum; i++) {
                        that.selectEle(arr[i], settings);
                    }
                } else {
                    that.showInfo($treeBody, "没有找到同名节点");
                }
            } else {
                that.showInfo($treeBody, "查询内容不能为空");
            }
        },

        searchNodeInJson: function (text) {
            if (text) {
                var that = this,
                    $treeBody = that.$treeBody,
                    settings = that.settings,
                    arr = that.getObjsByText(this.jsonTree, text, settings),
                    obj, selectedNum, id, $target, $sNode;
                if (arr.length > 0) {
                    that.showInfo($treeBody, "共搜索到" + arr.length + "个节点");
                    if (settings["close_same_level"]) {
                        selectedNum = 1;
                    } else {
                        selectedNum = arr.length;
                    }

                    for (var i = 0; i < selectedNum; i++) {
                        obj = arr[i];
                        id = obj["data"][settings["identify_field"]];
                        that.select(id, $treeBody, settings);
                    }
                } else {
                    that.showInfo($treeBody, "没有找到同名节点");
                }
            } else {
                that.showInfo($treeBody, "查询内容不能为空");
            }
        },

        select: function(id, $treeBody, settings) {
            var $target = $treeBody.find("#" + id),
                $sNode;

            if($target.length) {
                $sNode = $target.parent("li");
                $sNode.parents("ul").delay(settings['delay']).slideDown(settings['duration'], function() {
                    $sNode.parents("ul").parent("li").addClass("mtree-open").removeClass('mtree-closed');
                });

                $target.click();

                return true;
            }
        },

        selectEle: function(ele, settings) {
            var $target = $(ele),
                $sNode;

            if($target.length) {
                $sNode = $target.parent("li");
                $sNode.parents("ul").delay(settings['delay']).slideDown(settings['duration'], function () {
                    $sNode.parents("ul").parent("li").addClass("mtree-open").removeClass('mtree-closed');
                });

                $target.click();

                return true;
            }
        },

        getEleByInnerText: function($treeBody, text) {
            var $nodes  = $treeBody.find('li>a'),
                triggers = [],
                $children;

            $nodes.each(function() {
                $children = $(this).children().remove();
                if($(this).text() == text) {
                    triggers.push(this);
                }

                if($children) {
                    $(this).append($children);
                }
            });

            return triggers;
        },

        getObjById: function (nodeData, id, settings) {
            var obj,
                arr = nodeData[settings['child_field']],
                callee = arguments.callee;
            $.each(arr, function (index, item) {
                if (item[settings["identify_field"]] == id) {
                    obj = {
                        "data": item,
                        "parent": nodeData,
                        "index": index
                    };
                    return false;
                } else {
                    if (item[settings["child_field"]]) {
                        var result = callee(item, id, settings);
                        if (result) {
                            obj = result;
                            return false;
                        }
                    }
                }
            });

            return obj;
        },

        getObjsByText: function (nodeData, text, settings) {
            var results = [],
                obj,
                arr = nodeData[settings['child_field']],
                callee = arguments.callee;
            $.each(arr, function (index, item) {
                if (item[settings["display_field"]] == text) {
                    obj = {
                        "data": item,
                        "parent": nodeData,
                        "index": index
                    };
                    results.push(obj);
                }
                if (item[settings["child_field"]]) {
                    var result = callee(item, text, settings);
                    if (result.length > 0) {
                        $.merge(results, result);
                    }
                }
            });

            return results;
        },

        showInfo: function ($treeBody, text) {
            var $info = $('<span class="no-result-info"/>').text(text).appendTo($treeBody),
                $close = $('<span class="no-result-close"/>').text("×").appendTo($info);
            $close.bind("click", function (e) {
                $info.remove();
            });
            $info.show(200);

            window.setTimeout(function () {
                $info.hide(200);
                window.setTimeout(function () {
                    $info.remove();
                }, 300);
            }, 1500);
        },

        contextMenu: function() {
            var that = this;

            if($.fn.smartMenu) {
                $(that.$treeBody).find("li").smartMenu(that.menuItems, that.contextMenuOpts);
            } else {
                throw new Error("need jquery-smartMenu.js to supply context menu.");
            }
        },

        /**
         * 插入新节点
         * @param trigger 要插入新节点的元素
         * @param pos 插入的位置， jQuery的添加节点函数名，包括append，prepend?, before, after?等
         * @returns {*|HTMLElement}
         */
        insertNode: function (trigger, pos) {
            var that = this,
                $li = $('<li/>'),
                $input = $('<input type="text"/>').attr('id', 'insertIpt').val("新建节点").appendTo($li),
                $targetEle, childrenNum, triggerObj,
                level, triggerClass, levelClassIndex;

            if($(trigger).hasClass("mtree-closed")) {
                that.selectEle($(trigger).children("a:first"), that.settings);
            }

            if(pos == "append") {
                childrenNum = $(trigger).children("ul").children("li").length;
                if(childrenNum > 0) {
                    $targetEle = $(trigger).children("ul");
                } else {
                    $targetEle = $('<ul>').css('overflow', 'hidden').appendTo(trigger);

                    //添加级别
                    triggerClass = $(trigger).closest('ul').attr('class');
                    levelClassIndex = triggerClass.indexOf('mtree-level-');
                    if(levelClassIndex > -1) {
                        level = parseInt(triggerClass.substr(levelClassIndex + 12, 1)) + 1;
                        $targetEle.addClass('mtree-level-' + level);
                    }
                }

                $input.data("index", childrenNum);
            } else if(pos == "before") {
                $targetEle = $(trigger);

                triggerObj = that.getObjById(that.jsonTree, trigger.firstChild.id, that.settings);
                if(triggerObj instanceof Object) {
                    $input.data("index", triggerObj['index']);
                }
            }

            $targetEle[pos]($li);
            $li.smartMenu(that.menuItems, that.contextMenuOpts);
            $input.select();
            $input.data("operation", that.OPERATION.NEW);
            $input.data("trigger", trigger);
            this.initRepalceEvt($input);
            return $li;
        },
        deleteNode: function (trigger) {
            var that = this,
                $trigger = $(trigger);

            var obj = that.getObjById(that.jsonTree, trigger.firstChild.id, that.settings);
            var sureDel = that.settings.callback.call(trigger.firstChild, obj, that.OPERATION.DELETE);

            if(sureDel) {
                //delete data
                obj["parent"][that.settings['child_field']].splice(obj["index"], 1);
                //delete dom
                if($trigger.closest('ul').children('li').length > 1) {
                    $trigger.remove();
                } else {
                    $trigger.closest('ul').parent().removeClass('mtree-node').removeClass('mtree-open').removeClass('mtree-close');
                    $trigger.closest('ul').remove();
                }
            }
        },
        renameNode: function (trigger) {
            var that = this,
                triggerA = trigger.firstChild,
                $children = $(triggerA).children().remove(),
                $input = $('<input type="text"/>').attr("id", trigger.firstChild.id).val($(triggerA).text());
            $(triggerA).replaceWith($input);
            $input.select();
            $input.data('operation', that.OPERATION.RENAME);
            $input.data('text', $(triggerA).text());

            that.initRepalceEvt($input, $children);
        },

        initRepalceEvt: function($input, $children) {
            var that = this;
            $input.bind("keypress", function(e) {
                e.stopPropagation();
                if(e.which == 13) {
                    if($input.val().trim()) {
                        $input.unbind("keydown"); //移除enter
                        $(document).unbind("click"); //移除click
                        that.repalceIpt2A($input, $children);
                    } else {
                        that.showInfo(that.$treeBody, "新节点名不能为空");
                        $input.select();
                    }
                }
            });
            $(document).bind("click", function(e) {
                e.stopPropagation();
                var node = e.target || e.srcElement;
                if(node.id != $input.attr("id")) {
                    if($input.val().trim()) {
                        $input.unbind("keydown"); //移除enter
                        $(document).unbind("click"); //移除click
                        that.repalceIpt2A($input, $children);
                    } else {
                        that.showInfo(that.$treeBody, "新节点名不能为空");
                        $input.select();
                    }
                }
            });
        },

        repalceIpt2A: function($input, $children) {
            var that = this,
                text = $input.val().trim(),
                $A = $('<a/>')
                    .attr("id", $input.attr('id'))
                    .attr("href", "javascript:void(0);")
                    .text(text)
                    .append($children);

            var trigger = $input.data("trigger");
            $input.removeData("trigger");

            $A.data("operation", $input.data('operation'));
            $A.data("index", $input.data('index'));
            $A.data("text", $input.data('text'));
            $input.removeData('operation');
            $input.removeData('index');
            $input.replaceWith($A);

            if($children) {
                $(trigger).addClass("mtree-node");
                $(trigger).addClass("mtree-open");
                $(trigger).removeClass("mtree-closed");
            }

            that.unbindOperation();
            that.bindOperation();
            that.selectEle($A, that.settings);
            return $A;
        },

        modifyNode: function(jsonNode, settings) {
            var $target = $(this);
            $target.text(jsonNode[settings["display_field"]])
                .attr("href", "javascript:void(0);")
                .attr("id", jsonNode[settings["identify_field"]]);
            if(settings["addition_field"]) {
                a.append($('<span class="node-data-num"/>').text((jsonNode[settings["addition_field"]] || settings['addition_field_default']) + (jsonNode[settings["addition_field_suffix"]] || '')));
            }
        }
    };

    $.fn[pluginName] = function (dataList, options) {
        return this.each(function() {
            //if (!$.data(this, "plugin_" + pluginName)) {
                $.data(this, "plugin_" + pluginName, new Mtree(this, dataList, options));
            //}
        });
    }
})(jQuery, window);
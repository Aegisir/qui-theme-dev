<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  QuiActionSheet, QuiArea, QuiAuthorization, QuiAvatar, QuiAvatarGroup, QuiBadge,
  QuiBottomSheet, QuiButton, QuiCheckbox, QuiDatetimePicker, QuiDialog, QuiDivider,
  QuiEmptyState, QuiFlex, QuiIndexes, QuiInfiniteLoading, QuiLabel, QuiList, QuiLoading, QuiNavigationBar,
  QuiNoticeBar, QuiNotification, QuiPicker, QuiPopup, QuiProgress, QuiRadio,
  QuiSearchBar, QuiShareSheet, QuiSlipDrawer, QuiSwiper, QuiSwitch, QuiTabBar,
  QuiTabs, QuiTag, QuiTextField, QuiToast, QuiTooltip, QuiVideoToast,
} from '@qui-theme/ui'
import { swiperImages } from '@qui-theme/ui/assets'
import DemoSection from '../components/DemoSection.vue'
import { entries } from '../catalog'

const props = defineProps<{ slug: string }>()
const entry = computed(() => entries.find((item) => item.slug === props.slug))
const goBack = () => window.history.back()
const checked = ref(true)
const checkedTwo = ref(false)
const enabled = ref(true)
const radio = ref('a')
const tab = ref(0)
const tabBar = ref(0)
const query = ref('')
const input = ref('')
const count = ref(4)
const infiniteLoading = ref(false)
const progress = ref(62)
const slipOpen = ref(false)
const more = ref(false)
const overlay = ref('')
const selected = ref<string[]>(['选项一'])
const toast = ref(false)
const videoToast = ref(false)
const noticeVisible = ref(true)
const items = [
  { title: '标题文字', description: '副标题内容', badge: '12', arrow: true },
  { title: '标题文字', description: '副标题内容', arrow: true },
]
const options = ['选项一', '选项二', '选项三']
let loadTimer: number | undefined
const shown = (name: string) => overlay.value === name
const open = (name: string) => { overlay.value = name }
const close = () => { overlay.value = '' }
const notify = () => { toast.value = true }
const loadMore = () => {
  if (infiniteLoading.value || more.value) return
  infiniteLoading.value = true
  count.value += 4
  more.value = count.value >= 16
  window.clearTimeout(loadTimer)
  loadTimer = window.setTimeout(() => { infiniteLoading.value = false }, 250)
}
onBeforeUnmount(() => window.clearTimeout(loadTimer))
</script>

<template>
  <main class="qui-demo-page">
    <QuiNavigationBar :title="entry?.title" left="‹" @left-click="goBack" />

    <template v-if="slug === 'nav-bar'">
      <DemoSection title="基础用法"><QuiNavigationBar title="标题文字" left="‹" right="···" @left-click="notify" @right-click="notify" /></DemoSection>
      <DemoSection title="主色导航"><QuiNavigationBar title="标题文字" left="‹" right="···" primary /></DemoSection>
    </template>
    <template v-else-if="slug === 'tabbar'">
      <DemoSection title="主导航"><QuiTabBar v-model="tabBar" :items="['消息', '联系人', '动态', '我的']" /></DemoSection>
      <DemoSection title="带红点"><QuiTabBar :items="[{ label: '消息', value: 0, badge: '99+' }, '联系人', '动态', '我的']" /></DemoSection>
    </template>
    <template v-else-if="slug === 'tab'">
      <DemoSection title="基础用法"><QuiTabs v-model="tab" :items="['推荐', '关注', '热门']" /></DemoSection>
      <DemoSection title="胶囊页签"><QuiTabs v-model="tab" :items="['推荐', '关注', '热门']" pill /></DemoSection>
      <DemoSection title="可滚动页签"><QuiTabs v-model="tab" :items="['推荐', '关注', '热门', '附近', '直播']" scrollable /></DemoSection>
    </template>
    <template v-else-if="slug === 'list'">
      <DemoSection title="基础列表"><QuiList :items="items" @select="notify" /></DemoSection>
      <DemoSection title="分组列表"><QuiList :items="items.slice(0, 1)" /><QuiDivider /><QuiList :items="items.slice(1)" /></DemoSection>
    </template>
    <template v-else-if="slug === 'divider'"><DemoSection title="基础用法"><QuiDivider /><div class="qui-demo-note">分割线</div><QuiDivider text="文字分割线" /><QuiDivider inset /></DemoSection></template>
    <template v-else-if="slug === 'avatar'">
      <DemoSection title="头像尺寸"><div class="qui-demo-row"><QuiAvatar :size="32" /><QuiAvatar :size="48" /><QuiAvatar :size="64" /></div></DemoSection>
      <DemoSection title="头像组"><QuiAvatarGroup :items="Array(5).fill('')" /></DemoSection>
    </template>
    <template v-else-if="slug === 'tag'">
      <DemoSection title="基础标签"><div class="qui-demo-row"><QuiTag>默认</QuiTag><QuiTag type="brand">品牌色</QuiTag><QuiTag type="success">成功</QuiTag><QuiTag type="warning">提醒</QuiTag></div></DemoSection>
      <DemoSection title="描边与关闭"><div class="qui-demo-row"><QuiTag outline type="brand">描边标签</QuiTag><QuiTag closable @close="notify">可关闭</QuiTag></div></DemoSection>
    </template>
    <template v-else-if="slug === 'button'">
      <DemoSection title="按钮类型"><QuiButton @click="notify">主要按钮</QuiButton><div class="qui-demo-row"><QuiButton type="secondary" :block="false">次要</QuiButton><QuiButton type="ghost" :block="false">幽灵</QuiButton><QuiButton type="danger" :block="false">危险</QuiButton></div></DemoSection>
      <DemoSection title="按钮尺寸"><div class="qui-demo-row"><QuiButton size="mini" :block="false">迷你</QuiButton><QuiButton size="small" :block="false">小型</QuiButton><QuiButton size="medium" :block="false">中型</QuiButton></div></DemoSection>
      <DemoSection title="状态"><div class="qui-demo-row"><QuiButton disabled :block="false">禁用</QuiButton><QuiButton loading :block="false">加载中</QuiButton></div></DemoSection>
    </template>
    <template v-else-if="slug === 'switch'"><DemoSection title="基础用法"><div class="qui-demo-row is-between"><span>开启通知</span><QuiSwitch v-model="enabled" /></div><div class="qui-demo-row is-between"><span>禁用状态</span><QuiSwitch :model-value="false" disabled /></div></DemoSection></template>
    <template v-else-if="slug === 'checkbox'"><DemoSection title="复选框"><QuiCheckbox v-model="checked">选项一</QuiCheckbox><QuiCheckbox v-model="checkedTwo">选项二</QuiCheckbox><QuiCheckbox disabled>不可选</QuiCheckbox><QuiRadio v-model="radio" value="a">单选一</QuiRadio><QuiRadio v-model="radio" value="b">单选二</QuiRadio></DemoSection></template>
    <template v-else-if="slug === 'search-bar'"><DemoSection title="搜索框"><QuiSearchBar v-model="query" white placeholder="搜索" @search="notify" /><QuiSearchBar v-model="query" placeholder="搜索内容" @search="notify" /></DemoSection></template>
    <template v-else-if="slug === 'picker'"><DemoSection title="选择器"><button class="qui-demo-link" @click="open('picker')"><span>普通选择器</span><span>{{ selected.join(' / ') || '请选择' }}　›</span></button><QuiPicker :show="shown('picker')" v-model="selected" :columns="[options]" @update:show="close" /></DemoSection></template>
    <template v-else-if="slug === 'input'"><DemoSection title="文本输入"><QuiTextField v-model="input" label="用户名" placeholder="请输入用户名" hint="请输入 2–20 个字符" :maxlength="20" /><QuiTextField label="手机号" placeholder="请输入手机号" type="tel" /><QuiTextField label="验证码" placeholder="请输入验证码" error="验证码错误" /></DemoSection></template>
    <template v-else-if="slug === 'action-sheet'"><DemoSection title="动作面板"><button class="qui-demo-link" @click="open('action')">打开动作面板<span>›</span></button><QuiActionSheet :show="shown('action')" title="标题" description="描述信息" :actions="[{ label: '选项一', value: 1 }, { label: '删除', value: 2 }]" @update:show="close" @select="notify" /></DemoSection></template>
    <template v-else-if="slug === 'share-picture'"><DemoSection title="分享面板"><QuiButton @click="open('share')">立即分享</QuiButton><QuiShareSheet :show="shown('share')" @update:show="close" @select="notify" /></DemoSection></template>
    <template v-else-if="slug === 'bottom-sheet'"><DemoSection title="底部面板"><QuiButton @click="open('bottom')">打开面板</QuiButton><QuiBottomSheet :show="shown('bottom')" title="底部面板" @update:show="close">面板内容可以放置自定义信息和操作。</QuiBottomSheet></DemoSection></template>
    <template v-else-if="slug === 'toast'"><DemoSection title="提示类型"><div class="qui-demo-grid"><QuiButton @click="notify">普通提示</QuiButton><QuiButton type="secondary" @click="notify">成功提示</QuiButton><QuiButton type="danger" @click="notify">错误提示</QuiButton></div></DemoSection></template>
    <template v-else-if="slug === 'video-toast'"><DemoSection title="音视频提示"><QuiButton @click="videoToast = true">显示音视频提示</QuiButton><QuiVideoToast v-model:show="videoToast" icon="♪" message="正在播放语音" action="查看" @action="notify" /></DemoSection></template>
    <template v-else-if="slug === 'notice-bar'"><DemoSection title="通告栏"><QuiNoticeBar text="这是一条通告栏提示信息" action="查看" @action="notify" /><QuiNoticeBar text="请注意相关重要通知" type="warning" closable @close="noticeVisible = false" v-if="noticeVisible" /></DemoSection></template>
    <template v-else-if="slug === 'tooltips'"><DemoSection title="提示气泡"><div class="qui-demo-row"><QuiTooltip text="品牌色提示"><QuiButton size="small" :block="false">品牌色</QuiButton></QuiTooltip><QuiTooltip text="深色提示" theme="dark"><QuiButton size="small" type="secondary" :block="false">深色</QuiButton></QuiTooltip></div></DemoSection></template>
    <template v-else-if="slug === 'dialog'"><DemoSection title="弹窗"><QuiButton @click="open('dialog')">打开弹窗</QuiButton><QuiDialog :show="shown('dialog')" title="提示" message="这是弹窗内容" @update:show="close" @confirm="notify" /></DemoSection></template>
    <template v-else-if="slug === 'loading'"><DemoSection title="加载状态"><QuiLoading /><QuiLoading text="正在加载" color="#09f" :size="32" /><QuiButton loading>加载中</QuiButton></DemoSection></template>
    <template v-else-if="slug === 'label'"><DemoSection title="富媒体控件"><QuiLabel type="brand">QQ 会员</QuiLabel><QuiLabel type="yellow">官方认证</QuiLabel><QuiLabel>普通标签</QuiLabel></DemoSection></template>
    <template v-else-if="slug === 'badge'"><DemoSection title="红点"><div class="qui-demo-row"><QuiBadge><span>消息</span></QuiBadge><QuiBadge :value="8"><span>联系人</span></QuiBadge><QuiBadge :value="128"><span>动态</span></QuiBadge></div></DemoSection></template>
    <template v-else-if="slug === 'authorization'"><DemoSection title="授权面板"><QuiButton @click="open('authorization')">申请授权</QuiButton><QuiAuthorization :show="shown('authorization')" message="允许访问你的昵称、头像等公开信息" @update:show="close" @confirm="notify" /></DemoSection></template>
    <template v-else-if="slug === 'notification'"><DemoSection title="通知提示"><QuiButton @click="open('notification')">显示通知</QuiButton><QuiNotification :show="shown('notification')" title="通知标题" message="这是一条通知提示" action="查看" @action="notify" @update:show="close" /></DemoSection></template>
    <template v-else-if="slug === 'blank-page'"><DemoSection title="空白页"><QuiEmptyState title="暂无内容" description="当前还没有任何内容" action="刷新" @action="notify" /></DemoSection></template>
    <template v-else-if="slug === 'area'"><DemoSection title="地区选择"><button class="qui-demo-link" @click="open('area')">选择地区<span>中国大陆　›</span></button><QuiArea :show="shown('area')" @update:show="close" /></DemoSection></template>
    <template v-else-if="slug === 'datetime-picker'"><DemoSection title="日期选择"><button class="qui-demo-link" @click="open('date')">选择日期<span>›</span></button><QuiDatetimePicker :show="shown('date')" @update:show="close" /></DemoSection></template>
    <template v-else-if="slug === 'row'"><DemoSection title="弹性布局"><QuiFlex :gap="8"><div class="qui-flex-demo">左侧</div><div class="qui-flex-demo">中间</div><div class="qui-flex-demo">右侧</div></QuiFlex><QuiFlex direction="column" align="stretch"><div class="qui-flex-demo">纵向布局</div><div class="qui-flex-demo">纵向布局</div></QuiFlex></DemoSection></template>
    <template v-else-if="slug === 'popup'"><DemoSection title="弹出层"><QuiButton @click="open('popup')">从中间弹出</QuiButton><QuiPopup :show="shown('popup')" @update:show="close"><div class="qui-demo-popup">自定义弹层内容<QuiButton size="small" @click="close">关闭</QuiButton></div></QuiPopup></DemoSection></template>
    <template v-else-if="slug === 'progress'"><DemoSection title="进度条"><QuiProgress :value="progress" label="下载进度" /><QuiProgress :value="85" color="#15d173" :height="4" /><QuiButton size="small" :block="false" @click="progress = progress >= 100 ? 10 : progress + 10">增加进度</QuiButton></DemoSection></template>
    <template v-else-if="slug === 'slip-drawer'"><DemoSection title="滑动抽屉"><QuiSlipDrawer v-model:open="slipOpen" @select="notify"><div class="qui-demo-slip">向左滑动显示操作</div></QuiSlipDrawer><button class="qui-link-button" @click="slipOpen = !slipOpen">{{ slipOpen ? '收起' : '展开' }}</button></DemoSection></template>
    <template v-else-if="slug === 'swiper'"><DemoSection title="轮播"><QuiSwiper autoplay :interval="3000"><img v-for="(image, index) in swiperImages" :key="image" class="qui-swiper-demo__image" :src="image" :alt="`轮播示例 ${index + 1}`" /></QuiSwiper></DemoSection></template>
    <template v-else-if="slug === 'infinite-loading'"><DemoSection title="无限滚动"><QuiList :items="Array.from({ length: count }, (_, i) => ({ title: `列表内容 ${i + 1}`, description: '向下滚动加载更多', arrow: true }))" /><QuiInfiniteLoading :loading="infiniteLoading" :finished="more" @load="loadMore" /></DemoSection></template>
    <template v-else-if="slug === 'indexes'"><DemoSection title="索引列表"><QuiIndexes @select="notify" /></DemoSection></template>
    <DemoSection v-else title="组件示例"><p class="qui-demo-note">{{ entry?.title ?? '组件' }}</p></DemoSection>
    <QuiToast :show="toast" message="操作成功" type="success" :duration="1500" @update:show="toast = $event" />
  </main>
</template>

import QuiUI, { QuiButton, QuiList, QuiPicker, QuiReplicaRenderer, type ReplicaTarget } from '../packages/qui-ui/dist/types/index'
import { loadRegions, type QuiDistrict } from '../packages/qui-ui/dist/types/regions'
import icons from '../packages/qui-ui/dist/types/icons'
import iconIndex from '../packages/qui-ui/dist/types/icon-index'
import iconGroups from '../packages/qui-ui/dist/types/icon-groups'
import tokens from '../packages/qui-ui/dist/types/theme'

const button: InstanceType<typeof QuiButton>['$props'] = { nativeType: 'submit', onClick: (event: MouseEvent) => event.preventDefault() }
const list: InstanceType<typeof QuiList>['$props'] = { onSelect: (item, index) => `${item.title}:${index}` }
const picker: InstanceType<typeof QuiPicker>['$props'] = { onConfirm: (values: Array<string | number>) => values.length }
const renderer: InstanceType<typeof QuiReplicaRenderer>['$props'] = { markup: '', onClick: (target: ReplicaTarget) => target.controlIndex }
// @ts-expect-error Native button types must match the HTML API.
const invalidButton: InstanceType<typeof QuiButton>['$props'] = { nativeType: 'other' }
// @ts-expect-error Click payloads are MouseEvents.
const invalidEvent: InstanceType<typeof QuiButton>['$props'] = { onClick: (_value: number) => {} }
const regions: Promise<QuiDistrict[]> = loadRegions()
const svg: string = icons.Add56
const group: string = iconIndex.Add56
const names: string[] = iconGroups.common
// @ts-expect-error Icon keys remain typed in the published declarations.
icons.NonexistentIcon
void [QuiUI, button, list, picker, renderer, invalidButton, invalidEvent, regions, svg, group, names, tokens]

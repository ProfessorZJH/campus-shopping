import ProductImage from './ProductImage.js';
import {api} from '../services/api.js';
const {ref,computed,onBeforeUnmount,watch}=Vue;
const VALID_TYPES=new Set(['image/jpeg','image/png','image/gif']);
const MAX_BYTES=2000000;

/** 选择文件 -> 预览 -> 上传 -> 收到 /media/ 路径。真正保存由商品表单负责。 */
export default {
  name:'ProductImageField',components:{ProductImage},
  props:{modelValue:{type:String,default:''},merchantId:{type:String,required:true},disabled:{type:Boolean,default:false},demo:{type:Boolean,default:false}},
  emits:['update:modelValue','busy','invalid'],
  setup(props,{emit}){
    const busy=ref(false),error=ref(''),notice=ref(''),localUrl=ref('');
    let alive=true;
    function release(){if(localUrl.value){URL.revokeObjectURL(localUrl.value);localUrl.value='';}}
    onBeforeUnmount(()=>{alive=false;release();if(busy.value)emit('busy',false);if(error.value)emit('invalid',false);});
    watch(()=>props.modelValue,()=>{if(!busy.value)release();});
    const displayed=computed(()=>localUrl.value||props.modelValue||'');
    function clear(){if(props.disabled||busy.value)return;release();error.value='';notice.value='';emit('invalid',false);emit('update:modelValue','');}
    async function choose(event){
      const file=event.target.files?.[0];event.target.value='';
      if(!file||props.disabled||busy.value)return;
      error.value='';notice.value='';emit('invalid',false);
      if(!VALID_TYPES.has(file.type)){error.value='请选择 JPG、PNG 或 GIF 图片';emit('invalid',true);return;}
      if(!file.size||file.size>MAX_BYTES){error.value='图片大小不能超过 2 MB';emit('invalid',true);return;}
      release();localUrl.value=URL.createObjectURL(file);
      if(props.demo){notice.value='仅本地预览，未上传';return;}
      busy.value=true;emit('busy',true);
      try{
        const base64=await new Promise((resolve,reject)=>{
          const reader=new FileReader();
          reader.onerror=()=>reject(new Error('图片读取失败'));
          reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
          reader.readAsDataURL(file);
        });
        const result=await api('/merchants/'+encodeURIComponent(props.merchantId)+'/images',{
          method:'POST',body:{filename:file.name,contentType:file.type,base64}
        });
        if(!/^\/media\/[a-f0-9-]+\.png$/.test(result?.url||''))throw new Error('图片上传返回地址无效');
        if(!alive)return;
        emit('update:modelValue',result.url);
        notice.value='上传成功，保存商品后生效';
        release();
      }catch(err){if(alive){error.value=err.message||'上传失败';emit('invalid',true);release();}}
      finally{if(alive){busy.value=false;emit('busy',false);}}
    }
    return {choose,clear,displayed,busy,error,notice};
  },
  template:`<div class="product-image-field">
    <div class="product-image-preview"><ProductImage :src="displayed" alt="商品主图预览" loading="eager"/><span v-if="busy" class="product-image-busy">上传中…</span></div>
    <div class="product-image-controls">
      <label class="image-upload-button" :class="{disabled:disabled||busy}">
        <Icon name="upload" :size="15"/>{{modelValue||displayed?'更换主图':'上传主图'}}
        <input type="file" accept="image/png,image/jpeg,image/gif" aria-label="选择商品主图" :disabled="disabled||busy" @change="choose"/>
      </label>
      <button v-if="modelValue||displayed||error" class="image-remove-button" type="button" :disabled="disabled||busy" @click="clear">移除</button>
      <small>JPG / PNG / GIF · ≤ 2MB</small>
      <span v-if="error" class="image-field-error" role="alert">{{error}}</span>
      <span v-else-if="notice" class="image-field-notice" role="status">{{notice}}</span>
    </div>
  </div>`
};

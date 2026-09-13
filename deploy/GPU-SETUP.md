# 已验证的课堂 GPU 环境

2026-09-12：Lambda A10 24 GB、Python 3.10、CUDA driver capability 12.8。

```bash
python3 -m venv ~/supportops-cu128
source ~/supportops-cu128/bin/activate
pip install 'vllm==0.11.0' 'transformers==4.57.1'
# 将 MODEL_API_KEY 通过主机环境配置，再运行：
bash deploy/vllm.sh
```

本次 smoke test 使用 `--gpu-memory-utilization 0.90 --enforce-eager`，上下文长度 12288。
版本是已验证的课堂复现基线，不代表适用于所有生产部署；升级后重新验证。
未固定版本的 vLLM 0.29.0 在该镜像上因驱动版本不匹配失败；旧 vLLM 与未限制的新版 transformers 组合也出现 tokenizer 接口不兼容。
安装前依据 [vLLM 官方 GPU 安装说明](https://docs.vllm.ai/en/latest/getting_started/installation/gpu/) 检查驱动与 wheel，而不是只检查 `pip install` 是否成功。

服务只绑定 127.0.0.1 且启用 API key。验证经 SSH 隧道进行；正式跨云访问必须先配置 Tunnel 和 Access。真实模型验证记录在 `course/gpu-evidence.json`；该记录不表示 Render worker 已上线。

课堂后按本次实例 ID 释放 GPU。不要根据名称批量删除已有资源。

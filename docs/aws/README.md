# AWS ドキュメント

Operation Nightcap の AWS 構想・デプロイに関するドキュメント一覧です。

## ドキュメント構成

| ドキュメント | 内容 |
|-------------|------|
| [アーキテクチャ構想](./ARCHITECTURE.md) | 全体構成図、フェーズ別ロードマップ、コスト見積もり、共有通貨設計 |
| [セキュリティチェックリスト](./SECURITY-CHECKLIST.md) | VPC、IAM、暗号化、EC2強化、モニタリング (SAA-C03対応) |

## デプロイスクリプト

実際のデプロイスクリプトは [`deploy/`](../../deploy/) にあります。

| ファイル | 用途 |
|---------|------|
| [`ec2-setup.sh`](../../deploy/ec2-setup.sh) | EC2 初期構築 (Docker, Nginx, fail2ban, SSL) |
| [`deploy.sh`](../../deploy/deploy.sh) | ワンコマンドデプロイ (git pull → Docker再構築) |

## フェーズ進捗

| フェーズ | 状態 | 概要 |
|---------|------|------|
| Phase 1: EC2 デプロイ | 準備完了 | EC2 + Docker + Nginx (無料枠) |
| Phase 2: ホームページ + CDN | 未着手 | S3 + CloudFront + Route 53 + ドメイン |
| Phase 3: 本番公開 + API | 未着手 | ALB + API Gateway + Lambda + DynamoDB |
| Phase 4: マルチゲーム | 未着手 | ECS Fargate + パスベースルーティング |
| Phase 5: 運用成熟 | 未着手 | CloudWatch + Auto Scaling + Budgets |

## 関連する AWS サービス

```
Compute:    EC2, ECS Fargate, Lambda
Storage:    S3, EBS
CDN:        CloudFront
Network:    VPC, Route 53, ALB
Database:   DynamoDB
Security:   IAM, ACM, KMS, Security Groups
Monitoring: CloudWatch, CloudTrail, VPC Flow Logs
API:        API Gateway
```

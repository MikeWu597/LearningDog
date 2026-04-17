import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Card, List, Tag, Toast, Button, Popup } from 'antd-mobile';
import { DownlandOutline } from 'antd-mobile-icons';
import { toPng } from 'html-to-image';
import dayjs from 'dayjs';
import { apiGetDailyRecords, apiGetStats, apiGetRecords } from '../utils/api';
import { useApp } from '../App';

function formatDuration(seconds) {
  if (!seconds) return '0分钟';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分钟`;
}

function CalendarHeatmap({ data }) {
  const today = dayjs();
  const startDate = today.subtract(90, 'day');
  const dataMap = {};
  (data || []).forEach(d => { dataMap[d.date] = d.total_seconds; });

  const weeks = [];
  let currentDate = startDate.startOf('week');

  while (currentDate.isBefore(today) || currentDate.isSame(today, 'day')) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      const seconds = dataMap[dateStr] || 0;
      const intensity = seconds === 0 ? 0 : seconds < 1800 ? 1 : seconds < 3600 ? 2 : seconds < 7200 ? 3 : 4;
      const colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
      week.push(
        <div
          key={dateStr}
          style={{
            width: 10, height: 10, borderRadius: 2,
            background: currentDate.isAfter(today) ? 'transparent' : colors[intensity],
          }}
        />
      );
      currentDate = currentDate.add(1, 'day');
    }
    weeks.push(
      <div key={`week-${weeks.length}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {week}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 2, overflowX: 'auto', padding: '8px 0' }}>
      {weeks}
    </div>
  );
}

export default function StudyRecords() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [daily, setDaily] = useState([]);
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const posterRef = useRef(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!user?.uuid) return;
    setLoading(true);
    Promise.all([
      apiGetDailyRecords(user.uuid),
      apiGetStats(user.uuid),
      apiGetRecords(user.uuid),
    ]).then(([dailyData, statsData, recordsData]) => {
      setDaily(dailyData);
      setStats(statsData);
      setRecords(recordsData);
    }).catch(() => {
      Toast.show({ content: '获取学习记录失败' });
    }).finally(() => setLoading(false));
  }, [user?.uuid]);

  const showPosterPreview = async () => {
    if (!posterRef.current) return;
    try {
      const dataUrl = await toPng(posterRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      setPreviewUrl(dataUrl);
      setPreviewVisible(true);
    } catch (err) {
      Toast.show({ content: err?.message || '生成海报失败' });
    }
  };

  const savePoster = async () => {
    if (!previewUrl) return;
    try {
      const link = document.createElement('a');
      link.download = `LearningDog_${user.username}_${dayjs().format('YYYY-MM-DD')}.png`;
      link.href = previewUrl;
      link.click();
      Toast.show({ content: '海报已保存' });
      setPreviewVisible(false);
    } catch (err) {
      Toast.show({ content: err?.message || '保存失败' });
    }
  };

  const todayRecord = daily.find(d => d.date === dayjs().format('YYYY-MM-DD'));

  return (
    <div className="mobile-screen mobile-screen-light">
      <NavBar onBack={() => navigate('/rooms')} right={
        <Button size="mini" onClick={showPosterPreview}>导出海报</Button>
      }>
        学习记录
      </NavBar>

      <div className="mobile-main" style={{ overflow: 'auto', padding: 12 }}>
        {/* Stats */}
        <Card style={{ borderRadius: 8, marginBottom: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#999' }}>今日专注</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', margin: '4px 0' }}>
            🔥 {todayRecord ? formatDuration(todayRecord.total_seconds) : '0分钟'}
          </div>
        </Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#999' }}>累计专注</div>
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>{stats ? formatDuration(stats.totalSeconds) : '-'}</div>
          </Card>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#999' }}>总天数</div>
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>{stats?.totalDays || 0} 天</div>
          </Card>
          <Card style={{ borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#999' }}>平均每日</div>
            <div style={{ fontSize: 14, fontWeight: 'bold' }}>{stats ? formatDuration(stats.avgDailySeconds) : '-'}</div>
          </Card>
        </div>

        {/* Heatmap */}
        <Card title="专注日历" style={{ borderRadius: 8, marginBottom: 12 }}>
          <CalendarHeatmap data={daily} />
        </Card>

        {/* Records */}
        <Card title="专注日志" style={{ borderRadius: 8 }}>
          <List>
            {records.slice(0, 30).map(record => (
              <List.Item
                key={record.id}
                description={record.end_time ? `结束于 ${dayjs(record.end_time).format('HH:mm')}` : '进行中'}
                extra={
                  <Tag color={record.duration_seconds ? 'success' : 'primary'}>
                    {record.duration_seconds ? formatDuration(record.duration_seconds) : '进行中'}
                  </Tag>
                }
              >
                {dayjs(record.start_time).format('MM-DD HH:mm')}
              </List.Item>
            ))}
          </List>
        </Card>
      </div>

      {/* Poster preview popup */}
      <Popup
        visible={previewVisible}
        onMaskClick={() => setPreviewVisible(false)}
        bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: 16, maxHeight: '80vh', overflow: 'auto' }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 'bold', marginBottom: 12 }}>海报预览</div>
          {previewUrl && (
            <img src={previewUrl} alt="poster" style={{ width: '100%', maxWidth: 320, borderRadius: 8 }} />
          )}
          <div style={{ marginTop: 16 }}>
            <Button
              block
              color="primary"
              onClick={savePoster}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <DownlandOutline /> 保存海报
            </Button>
          </div>
        </div>
      </Popup>

      {/* Hidden poster */}
      <div style={{ position: 'absolute', left: -9999 }}>
        <div ref={posterRef} style={{
          width: 360, padding: 24,
          background: 'linear-gradient(135deg, #e8f4fd 0%, #ffffff 50%, #dbeafe 100%)',
          color: '#1e293b', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>{user?.username} 的学习报告</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{dayjs().format('YYYY年MM月DD日')}</div>
          </div>
          <div style={{ background: '#2563eb', borderRadius: 14, padding: 24, textAlign: 'center', margin: '12px 0' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginBottom: 6 }}>今日专注</div>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: '#fff' }}>
              {todayRecord ? formatDuration(todayRecord.total_seconds) : '0分钟'}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', margin: '16px 0', padding: '0 4px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>累计专注</div>
              <div style={{ fontSize: 14, fontWeight: '600', color: '#334155' }}>{stats ? formatDuration(stats.totalSeconds) : '0分钟'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>累计天数</div>
              <div style={{ fontSize: 14, fontWeight: '600', color: '#334155' }}>{stats?.totalDays || 0} 天</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>平均每日</div>
              <div style={{ fontSize: 14, fontWeight: '600', color: '#334155' }}>{stats ? formatDuration(stats.avgDailySeconds) : '0分钟'}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: 16, color: '#2563eb', fontWeight: 'bold' }}>🐕 LearningDog</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>在线自习 · 互相监督</div>
          </div>
        </div>
      </div>
    </div>
  );
}
